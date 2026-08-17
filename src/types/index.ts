export interface MediaFile {
  name: string;
  /**
   * Path relative to the archive root (matching webkitRelativePath for local
   * folders). Unlike `url`, this survives a page reload, so it is what the
   * cache persists and what URLs are rehydrated from.
   */
  path: string;
  url: string;
  type: 'image' | 'video';
  index: number;
  size?: number;
}

/**
 * Which sidecar directory a post came from. Archives store reels, stories and
 * each story highlight in directories alongside the base profile; the viewer
 * folds them into one profile and routes them by kind.
 */
export type SourceKind = 'posts' | 'reels' | 'stories' | 'highlight';

export interface ArchiveSource {
  kind: SourceKind;
  /** Directory name relative to the archives root. */
  dir: string;
  /** Highlight title, for kind === 'highlight'. */
  title?: string;
}

export interface Post {
  id: string;
  date: string;
  username: string;
  caption: string;
  media: MediaFile[];
  thumbnail: string;
  isStory?: boolean;
  /** Defaults to 'posts' for archives without sidecar directories. */
  source?: SourceKind;
  /**
   * Instagram's own answer to "is this a reel", from a gallery-dl `.json`
   * sidecar. Undefined when the archive carries no such sidecar, which is when
   * the viewer has to fall back to guessing — see src/lib/post-tabs.ts.
   */
  isReel?: boolean;
  /** Highlight this post belongs to, for source === 'highlight'. */
  highlightTitle?: string;
}

/**
 * Common interface for both local File objects and remote server-side files.
 */
export interface ArchiveFile {
  name: string;
  webkitRelativePath: string;
  size: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  url?: string;
  /**
   * A URL pointing at this file's contents. Local files mint a disk-backed
   * blob: URL (no data is read into memory); remote files return their HTTP URL.
   */
  createObjectUrl(mimeHint?: string): string;
  /** True when createObjectUrl() returns a blob: URL that must be revoked. */
  readonly revocable: boolean;
  /** Which sidecar directory this file came from, when known. */
  source?: ArchiveSource;
  /** Last-modified time (ms). Used to date items whose filename has no date. */
  mtime?: number;
}

export interface ServerArchive {
  name: string;
  thumbnail: string;
  path: string;
  /** Null until the server has indexed this profile. */
  fileCount: number | null;
  /**
   * Directory-mtime signature. Cheap for the server to compute and sufficient
   * to detect changes, unlike a file count that would require a full walk.
   */
  signature?: string;
  /** Base profile plus any sidecar directories folded into it. */
  sources?: ArchiveSource[];
}

/** One entry from GET /api/archives/:name/files. */
export interface ServerArchiveFile {
  path: string;
  size: number;
  mtime: number;
  kind: SourceKind;
  title?: string;
}

export interface ProfileMetadata {
  username: string;
  fullName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  externalUrl: string;
  profilePic: string | null;
  allProfilePics: string[];
}

/** Shape of an archive entry persisted in IndexedDB. */
export interface CacheData {
  name: string;
  isLocal: boolean;
  fileCount: number;
  /** Server archives: the signature this entry was built from. */
  signature?: string;
  posts: Post[];
  stories: Post[];
  /** Story-highlight items, grouped by `highlightTitle`. */
  highlights?: Post[];
  profileMetadata: ProfileMetadata;
  timestamp: number;
  /**
   * Local archives only: whether a FileSystemDirectoryHandle was stored
   * alongside this entry, meaning media URLs can be rehydrated without
   * re-prompting for the folder.
   */
  hasDirectoryHandle?: boolean;
  /** Path of the profile picture, for rehydration (local archives). */
  profilePicPath?: string;
}
