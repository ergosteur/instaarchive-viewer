import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import os from 'os';
import { ArchiveIndex } from './src/lib/archive-index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const ARCHIVES_DIR = path.resolve(process.env.ARCHIVES_DIR || path.join(__dirname, '_sample-archives'));

console.log(`[Server] Initializing...`);
console.log(`[Server] Running as user: ${os.userInfo().username} (UID: ${os.userInfo().uid}, GID: ${os.userInfo().gid})`);
console.log(`[Server] Environment ARCHIVES_DIR: ${process.env.ARCHIVES_DIR}`);
console.log(`[Server] Resolved ARCHIVES_DIR: ${ARCHIVES_DIR}`);

// Ensure archives directory exists
if (!fs.existsSync(ARCHIVES_DIR)) {
  console.warn(`[Server] Warning: Archives directory not found at ${ARCHIVES_DIR}. Creating it...`);
  try {
    fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
  } catch (err) {
    console.error(`[Server] Failed to create archives directory:`, err);
  }
} else {
  console.log(`[Server] Archives directory exists.`);
}

const INDEX_PATH = process.env.ARCHIVE_INDEX_PATH
  || path.join(process.env.CACHE_DIR || os.tmpdir(), 'instaarchive-index.json');
const index = new ArchiveIndex(ARCHIVES_DIR, INDEX_PATH);

// Warm in the background: the first walk of a large archive root is slow, but
// everything after it is served from directory-mtime-keyed cache.
index.load()
  .then(() => index.warm())
  .catch(err => console.error('[Index] Warm failed:', err));

// Don't advertise the framework.
app.disable('x-powered-by');

/**
 * Baseline security headers.
 *
 * The CSP allows blob: and data: because archive media is rendered from object
 * URLs and cached thumbnails, and 'unsafe-inline' for styles because the
 * animation library sets inline styles. Scripts stay restricted to same-origin,
 * and no third-party origins are permitted at all — the app bundles its own
 * fonts and icons.
 */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), interest-cohort=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "img-src 'self' blob: data:",
    "media-src 'self' blob: data:",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
  next();
});

app.use(express.json());

/**
 * Resolve a user-supplied archive name to an absolute path inside ARCHIVES_DIR.
 *
 * Express decodes route params *after* segment matching, so a name like
 * `..%2f..%2fetc` arrives here as `../../etc` and would otherwise escape the
 * archives root. Returns null for anything that resolves outside it.
 */
const resolveArchivePath = (archiveName: string): string | null => {
  if (!archiveName || archiveName.includes('\0')) return null;
  const resolved = path.resolve(ARCHIVES_DIR, archiveName);
  if (resolved !== ARCHIVES_DIR && !resolved.startsWith(ARCHIVES_DIR + path.sep)) {
    console.warn(`[Security] Rejected archive name escaping ARCHIVES_DIR: ${archiveName}`);
    return null;
  }
  return resolved;
};

// API: List archives, grouped by profile. Costs one stat per source directory.
app.get('/api/archives', (req, res) => {
  try {
    const groups = index.groups();
    const archives = Array.from(groups.entries()).map(([owner, sources]) => ({
      name: owner,
      thumbnail: index.thumbnailFor(owner, sources),
      path: owner,
      // Null until that profile has been indexed; the client treats it as unknown.
      fileCount: index.countFor(sources),
      // Directory mtimes: cheap to compute and enough to invalidate a stale cache.
      signature: index.signatureFor(sources),
      sources,
    }));
    console.log(`[API] Returning ${archives.length} archives.`);
    res.json(archives);
  } catch (err: any) {
    if (err.code === 'EACCES') {
      console.error(`[API] Permission Denied! The server (UID ${os.userInfo().uid}) cannot read ${ARCHIVES_DIR}.`);
      console.error(`[API] Hint: If using Linux/Docker, check folder permissions (chmod 755) or SELinux context (append :z to your volume mount).`);
    } else {
      console.error('[API] Error listing archives:', err);
    }
    res.status(500).json({ error: 'Permission denied or failed to list archives' });
  }
});

/**
 * List every file belonging to a profile, across its base and sidecar dirs.
 *
 * Paths are relative to ARCHIVES_DIR (so they include the source directory) and
 * each entry carries its source kind, letting the client route posts, reels,
 * stories and highlights without re-deriving the naming rules.
 *
 * Served from the directory index; only a directory whose mtime changed is
 * re-walked.
 */
app.get('/api/archives/:name/files', async (req, res) => {
  const archiveName = req.params.name;
  if (!resolveArchivePath(archiveName)) {
    return res.status(400).json({ error: 'Invalid archive name' });
  }

  try {
    const files = await index.filesFor(archiveName);
    if (!files) return res.status(404).json({ error: 'Archive not found' });
    void index.save();
    res.json(files);
  } catch (err) {
    console.error('Error listing files:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Serve archive files. Archive contents are immutable in practice, so cache
// them aggressively; the client busts its own cache via fileCount.
app.use('/archives', express.static(ARCHIVES_DIR, {
  maxAge: '1y',
  immutable: true,
  index: false,
  dotfiles: 'ignore',
}));

// Serve production frontend
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Serving archives from: ${ARCHIVES_DIR}`);
});
