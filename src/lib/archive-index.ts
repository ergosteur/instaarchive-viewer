import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { ArchiveSource, SourceKind, groupArchiveDirectories } from './archive-grouping.js';

/**
 * On-disk archive index.
 *
 * Archives live on network storage where per-file `stat` costs ~1.4ms and does
 * not parallelise well, so walking every file on each request is unaffordable:
 * measured against a real 110k-file archive root, listing took ~52s.
 *
 * Directory `stat` is effectively free, so each source directory is indexed
 * once and re-used until its mtime changes. The index is warmed in the
 * background at startup and persisted, making steady-state requests instant.
 */

export interface IndexedFile {
  path: string;
  size: number;
  mtime: number;
  kind: SourceKind;
  title?: string;
}

interface DirIndex {
  dir: string;
  /** Directory mtime the index was built from; the cache key. */
  mtimeMs: number;
  files: IndexedFile[];
}

const MEDIA_RE = /\.(jpg|jpeg|png|webp|gif|bmp|tiff|mp4|webm|ogv|mov)$/i;
const STAT_CONCURRENCY = 16;

/**
 * Directories the walk must never descend into.
 *
 * NAS filesystems scatter sidecar metadata *inside* every folder, not just at
 * the share root: Synology writes `@eaDir` (thumbnails and indexing data),
 * `#recycle` holds deletions, and `.sync` is Resilio's state. Indexing those
 * would count NAS thumbnails as archive media and spend a stat on each one —
 * measured on a real share, `@eaDir` accounted for 12,516 of 123,023 files.
 *
 * The archive root is already filtered by prefix; this is the same rule applied
 * at every level below it.
 */
export const isSystemDirectory = (name: string): boolean =>
  name.startsWith('@') || name.startsWith('.') || name === '#recycle' || name === '#snapshot';

export class ArchiveIndex {
  private dirs = new Map<string, DirIndex>();
  private inFlight = new Map<string, Promise<DirIndex>>();
  private dirty = false;

  constructor(private archivesDir: string, private cachePath: string) {}

  /** Visible (non-system) directories at the archive root. */
  private listRootDirs(): string[] {
    return fs.readdirSync(this.archivesDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !isSystemDirectory(e.name) && !e.name.startsWith('_'))
      .map(e => e.name);
  }

  groups(): Map<string, ArchiveSource[]> {
    return groupArchiveDirectories(this.listRootDirs());
  }

  private dirMtime(dir: string): number {
    try {
      return fs.statSync(path.join(this.archivesDir, dir)).mtimeMs;
    } catch {
      return 0;
    }
  }

  /** Recursively list relative file paths without stat()ing them. */
  private walk(absDir: string, base = ''): string[] {
    let out: string[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const entry of entries) {
      if (isSystemDirectory(entry.name)) continue;
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) out = out.concat(this.walk(path.join(absDir, entry.name), rel));
      else if (entry.isFile()) out.push(rel);
    }
    return out;
  }

  private async buildDir(source: ArchiveSource): Promise<DirIndex> {
    const started = Date.now();
    const mtimeMs = this.dirMtime(source.dir);
    const absDir = path.join(this.archivesDir, source.dir);
    const relPaths = this.walk(absDir);

    // Only media needs a size (the client thumbnails anything over 1MiB), and
    // only highlights need an mtime (their filenames carry no date). Skipping
    // the rest avoids thousands of pointless round trips.
    const needsStat = (rel: string) => MEDIA_RE.test(rel) || source.kind === 'highlight';

    const files: IndexedFile[] = relPaths.map(rel => ({
      path: `${source.dir}/${rel}`,
      size: 0,
      mtime: 0,
      kind: source.kind,
      ...(source.title ? { title: source.title } : {}),
    }));

    const targets = files.filter((_, i) => needsStat(relPaths[i]));
    let cursor = 0;
    const worker = async () => {
      while (cursor < targets.length) {
        const file = targets[cursor++];
        try {
          const stat = await fsp.stat(path.join(this.archivesDir, file.path));
          file.size = stat.size;
          file.mtime = stat.mtimeMs;
        } catch { /* raced with a delete */ }
      }
    };
    await Promise.all(Array.from({ length: STAT_CONCURRENCY }, worker));

    console.log(
      `[Index] ${source.dir}: ${files.length} files (${targets.length} statted) in ${((Date.now() - started) / 1000).toFixed(1)}s`
    );
    this.dirty = true;
    return { dir: source.dir, mtimeMs, files };
  }

  /** Index for one source directory, rebuilding only if its mtime moved. */
  private async ensureDir(source: ArchiveSource): Promise<DirIndex> {
    const cached = this.dirs.get(source.dir);
    const mtimeMs = this.dirMtime(source.dir);
    if (cached && cached.mtimeMs === mtimeMs) return cached;

    // Collapse concurrent requests for the same directory into one walk.
    const existing = this.inFlight.get(source.dir);
    if (existing) return existing;

    const build = this.buildDir(source).then(index => {
      this.dirs.set(source.dir, index);
      this.inFlight.delete(source.dir);
      return index;
    }).catch(err => {
      this.inFlight.delete(source.dir);
      throw err;
    });
    this.inFlight.set(source.dir, build);
    return build;
  }

  /** All files for one profile, across its base and sidecar directories. */
  async filesFor(owner: string): Promise<IndexedFile[] | null> {
    const sources = this.groups().get(owner);
    if (!sources?.length) return null;
    const indexes = await Promise.all(sources.map(s => this.ensureDir(s)));
    return indexes.flatMap(i => i.files);
  }

  /**
   * A cheap change signature for a profile, used by the client to decide
   * whether its cached copy is stale. Built from directory mtimes only, so it
   * costs one stat per source directory rather than a full walk.
   */
  signatureFor(sources: ArchiveSource[]): string {
    return sources.map(s => `${s.dir}:${this.dirMtime(s.dir)}`).join('|');
  }

  /** File count for a profile, if its directories are already indexed. */
  countFor(sources: ArchiveSource[]): number | null {
    let total = 0;
    for (const source of sources) {
      const cached = this.dirs.get(source.dir);
      if (!cached) return null;
      total += cached.files.length;
    }
    return total;
  }

  /**
   * Best-effort profile picture.
   *
   * Probes the conventional filenames first (one stat each) and only falls back
   * to the indexed listing, so an unindexed archive still gets a thumbnail
   * without triggering a walk.
   */
  thumbnailFor(owner: string, sources: ArchiveSource[]): string {
    const base = sources.find(s => s.kind === 'posts') ?? sources[0];
    if (!base) return '';

    for (const candidate of [`${owner}.jpg`, `${owner}_profile_pic.jpg`, `${owner}.jpeg`, `${owner}.png`]) {
      if (fs.existsSync(path.join(this.archivesDir, base.dir, candidate))) {
        return `/archives/${encodeURI(`${base.dir}/${candidate}`)}`;
      }
    }

    const cached = this.dirs.get(base.dir);
    if (cached) {
      const pick = cached.files.find(f => /_profile_pic\.jpg$/i.test(f.path))
        ?? cached.files.find(f => /\.(jpg|jpeg|png|webp)$/i.test(f.path));
      if (pick) return `/archives/${encodeURI(pick.path)}`;
    }
    return '';
  }

  /** Walk every directory once, in the background, so first opens are fast. */
  async warm(): Promise<void> {
    const started = Date.now();
    const sources = [...this.groups().values()].flat();
    console.log(`[Index] Warming ${sources.length} source directories...`);
    for (const source of sources) {
      try {
        await this.ensureDir(source);
      } catch (err) {
        console.error(`[Index] Failed to index ${source.dir}:`, err);
      }
    }
    await this.save();
    console.log(`[Index] Warm complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }

  async load(): Promise<void> {
    try {
      const raw = await fsp.readFile(this.cachePath, 'utf8');
      const parsed: DirIndex[] = JSON.parse(raw);
      for (const entry of parsed) this.dirs.set(entry.dir, entry);
      console.log(`[Index] Loaded ${this.dirs.size} directories from ${this.cachePath}`);
    } catch {
      console.log('[Index] No usable index cache; will build from scratch.');
    }
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    try {
      await fsp.writeFile(this.cachePath, JSON.stringify([...this.dirs.values()]), 'utf8');
      this.dirty = false;
      console.log(`[Index] Persisted ${this.dirs.size} directories to ${this.cachePath}`);
    } catch (err) {
      console.warn('[Index] Could not persist index (continuing in memory):', err);
    }
  }
}
