/**
 * Archive directory naming rules.
 *
 * Shared by the server (to fold sidecar directories into one profile) and the
 * test suite. Kept free of Node built-ins so it can be imported from either.
 */

export type SourceKind = 'posts' | 'reels' | 'stories' | 'highlight';

export interface ArchiveSource {
  kind: SourceKind;
  /** Directory name relative to the archives root. */
  dir: string;
  /** Highlight title, for kind === 'highlight'. */
  title?: string;
}

/**
 * Sidecar directories sit next to the profile directory they belong to:
 *
 *   4utumn07                                 -> posts     (base)
 *   4utumn07 - reels                         -> reels
 *   story - 4utumn07                         -> stories
 *   story highlights - 4utumn07 - Sunstory   -> highlight "Sunstory"
 *
 * Instagram usernames cannot contain spaces, so matching the username as a
 * run of non-space characters reliably separates it from a highlight title
 * (titles may themselves contain spaces, dashes and emoji).
 */
export const classifyDirectory = (dirName: string): { owner: string; source: ArchiveSource } => {
  const highlight = /^story highlights - ([^ ]+) - (.+)$/.exec(dirName);
  if (highlight) {
    return { owner: highlight[1], source: { kind: 'highlight', dir: dirName, title: highlight[2] } };
  }

  const stories = /^story - ([^ ]+)$/.exec(dirName);
  if (stories) {
    return { owner: stories[1], source: { kind: 'stories', dir: dirName } };
  }

  const reels = /^([^ ]+) - reels$/.exec(dirName);
  if (reels) {
    return { owner: reels[1], source: { kind: 'reels', dir: dirName } };
  }

  return { owner: dirName, source: { kind: 'posts', dir: dirName } };
};

const RANK: Record<SourceKind, number> = { posts: 0, reels: 1, stories: 2, highlight: 3 };

/**
 * Group the archive root's directories by profile.
 *
 * A sidecar whose owner has no base directory still forms a group of its own,
 * so nothing becomes invisible just because the base profile is missing.
 */
export const groupArchiveDirectories = (dirNames: string[]): Map<string, ArchiveSource[]> => {
  const groups = new Map<string, ArchiveSource[]>();

  for (const dirName of dirNames) {
    const { owner, source } = classifyDirectory(dirName);
    if (!groups.has(owner)) groups.set(owner, []);
    groups.get(owner)!.push(source);
  }

  for (const sources of groups.values()) {
    sources.sort((a, b) => RANK[a.kind] - RANK[b.kind] || (a.title ?? '').localeCompare(b.title ?? ''));
  }

  return groups;
};
