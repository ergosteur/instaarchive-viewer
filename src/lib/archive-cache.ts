import * as idb from 'idb-keyval';
import { CacheData, Post } from '../types';
import { DirectoryHandle, ensureReadPermission, filesFromDirectory } from './directory-handle';
import { LocalArchiveFile } from './archive-files';

/**
 * Persistent archive cache.
 *
 * Keys are namespaced so that listing archives does not require deserializing
 * every thumbnail blob in the store: `archive:` entries are metadata, `thumb:`
 * entries are image blobs, `handle:` entries are directory handles.
 */
const ARCHIVE_PREFIX = 'archive:';
const THUMB_PREFIX = 'thumb:';
const HANDLE_PREFIX = 'handle:';

export const archiveKey = (name: string) => `${ARCHIVE_PREFIX}${name}`;
export const handleKey = (name: string) => `${HANDLE_PREFIX}${name}`;
/** Thumbnails are scoped per archive; post IDs alone collide across archives. */
export const thumbKey = (archive: string, postId: string) => `${THUMB_PREFIX}${archive}:${postId}`;

export const getCachedArchive = (name: string): Promise<CacheData | undefined> =>
  idb.get(archiveKey(name));

export const setCachedArchive = (data: CacheData) => idb.set(archiveKey(data.name), data);

/** Names of all cached archives, without loading their contents. */
export const listCachedArchiveNames = async (): Promise<string[]> =>
  (await idb.keys())
    .map(String)
    .filter(k => k.startsWith(ARCHIVE_PREFIX))
    .map(k => k.slice(ARCHIVE_PREFIX.length));

export const listCachedArchives = async (): Promise<CacheData[]> => {
  const names = await listCachedArchiveNames();
  const entries = await Promise.all(names.map(getCachedArchive));
  return entries.filter((e): e is CacheData => Boolean(e));
};

/** Remove an archive along with its handle and every thumbnail it owns. */
export const deleteCachedArchive = async (name: string) => {
  const thumbPrefix = `${THUMB_PREFIX}${name}:`;
  const stale = (await idb.keys()).map(String).filter(k => k.startsWith(thumbPrefix));
  await idb.delMany([archiveKey(name), handleKey(name), ...stale]);
};

export const saveDirectoryHandle = (name: string, handle: DirectoryHandle) =>
  idb.set(handleKey(name), handle);

export const getDirectoryHandle = (name: string): Promise<DirectoryHandle | undefined> =>
  idb.get(handleKey(name));

/**
 * One-time migration from the flat key layout (archive name as a bare key,
 * `thumb_<postId>` for thumbnails).
 *
 * Old local entries are dropped rather than migrated: their media URLs are
 * dead blob: URLs, so restoring them would render an archive of broken images.
 */
export const migrateLegacyCache = async () => {
  const keys = (await idb.keys()).map(String);
  const legacyThumbs = keys.filter(k => k.startsWith('thumb_'));
  const legacyArchives = keys.filter(
    k => !k.startsWith(ARCHIVE_PREFIX) && !k.startsWith(THUMB_PREFIX) &&
         !k.startsWith(HANDLE_PREFIX) && !k.startsWith('thumb_')
  );
  if (!legacyThumbs.length && !legacyArchives.length) return;

  const drop: string[] = [...legacyThumbs];
  for (const key of legacyArchives) {
    const data = await idb.get(key);
    drop.push(key);
    if (data && typeof data === 'object' && 'posts' in data && !(data as CacheData).isLocal) {
      // Server archives keep working: their URLs are plain HTTP paths.
      await setCachedArchive({ ...(data as CacheData), name: key });
    }
  }
  await idb.delMany(drop);
  console.log(`[Cache] Migrated legacy cache: dropped ${drop.length} stale keys.`);
};

/**
 * Rebuild a server archive's media URLs, which are stable HTTP paths.
 *
 * `path` is relative to the archives root and already carries the source
 * directory (which may be a sidecar such as `story - user`), so it is not
 * prefixed with the archive name. Entries cached before `path` existed fall
 * back to their stored URL.
 */
const rehydrateRemote = (posts: Post[]): Post[] =>
  posts.map(post => {
    const media = post.media.map(m => ({
      ...m,
      url: m.path ? `/archives/${encodeURI(m.path)}` : m.url,
    }));
    return { ...post, media, thumbnail: media[0]?.url ?? post.thumbnail };
  });

/**
 * Rebuild a local archive's media URLs from a live directory handle, minting
 * fresh blob: URLs for the paths recorded at scan time.
 *
 * Returns null when the folder is no longer reachable (permission declined, or
 * the handle no longer resolves), signalling the caller to re-prompt.
 */
const rehydrateLocal = async (
  posts: Post[],
  handle: DirectoryHandle,
  onUrl: (url: string) => void,
): Promise<Post[] | null> => {
  if (!(await ensureReadPermission(handle))) return null;

  let files: LocalArchiveFile[];
  try {
    files = await filesFromDirectory(handle);
  } catch (err) {
    console.warn('[Cache] Directory handle no longer readable:', err);
    return null;
  }

  const byPath = new Map(files.map(f => [f.webkitRelativePath, f]));

  return posts.map(post => {
    const media = post.media.map(m => {
      const file = byPath.get(m.path);
      if (!file) return { ...m, url: '' };
      const url = file.createObjectUrl(m.type === 'video' ? 'video/mp4' : 'image/jpeg');
      onUrl(url);
      return { ...m, url };
    });
    return { ...post, media, thumbnail: media[0]?.url ?? '' };
  });
};

export interface RestoredArchive {
  posts: Post[];
  stories: Post[];
  highlights: Post[];
  profileMetadata: CacheData['profileMetadata'];
}

/**
 * Turn a cache entry back into displayable state.
 *
 * `onUrl` receives every blob: URL minted so the caller can revoke them later.
 * Returns null if a local archive's folder can no longer be reached.
 */
export const restoreArchive = async (
  data: CacheData,
  onUrl: (url: string) => void,
): Promise<RestoredArchive | null> => {
  if (!data.isLocal) {
    return {
      posts: rehydrateRemote(data.posts),
      stories: rehydrateRemote(data.stories),
      highlights: rehydrateRemote(data.highlights ?? []),
      profileMetadata: data.profileMetadata,
    };
  }

  const handle = await getDirectoryHandle(data.name);
  if (!handle) return null;

  const posts = await rehydrateLocal(data.posts, handle, onUrl);
  if (!posts) return null;
  const stories = (await rehydrateLocal(data.stories, handle, onUrl)) ?? [];
  const highlights = (await rehydrateLocal(data.highlights ?? [], handle, onUrl)) ?? [];

  return { posts, stories, highlights, profileMetadata: data.profileMetadata };
};
