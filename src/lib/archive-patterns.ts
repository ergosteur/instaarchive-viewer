import { SourceKind } from '../types';

/**
 * Filename parsing rules for the archive formats the viewer understands.
 *
 * Kept as pure functions so the riskiest part of the scanner — deriving post
 * identity, date and carousel order from a filename — can be tested directly.
 */

/** Instagram export: `2023-04-12_user - Cq8LrxSJAJE - 2.jpg` */
export const EXPORT_RE = /^(\d{4}-\d{2}-\d{2})_(.+?) - (.+?)(?: - (\d+))?(?: - (story))?\.(.+)$/;

/** Instaloader: `2024-01-01_12-00-00_UTC_2.jpg` */
export const INSTALOADER_RE = /^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_UTC)(?:_(\d+))?(?:_(story))?\.(.+)$/;

/**
 * Story highlight: `user - C5dQPEYpd9W.mp4` — no date prefix.
 *
 * Loose enough to match ordinary filenames, so it is only applied to files the
 * server has already tagged as coming from a highlight directory.
 */
export const HIGHLIGHT_RE = /^(.+?) - ([A-Za-z0-9_-]+)\.(\w+)$/;

export interface ParsedFilename {
  postId: string;
  /** ISO date (YYYY-MM-DD), or '' when the filename carries none. */
  date: string;
  username: string;
  /** 1-based carousel position. */
  index: number;
  ext: string;
  isStory: boolean;
}

/**
 * Parse an archive filename into post identity.
 *
 * `kind` selects which patterns apply; `mtime` supplies a date for formats that
 * have none (highlights), so those items still sort and render sensibly.
 * Returns null when no pattern matches — e.g. a profile picture.
 */
export const parseArchiveFilename = (
  fileName: string,
  kind: SourceKind = 'posts',
  mtime?: number,
): ParsedFilename | null => {
  const exp = EXPORT_RE.exec(fileName);
  if (exp) {
    const [, date, username, postId, indexStr, story, ext] = exp;
    return {
      postId,
      date,
      username,
      index: indexStr ? parseInt(indexStr, 10) : 1,
      ext,
      isStory: Boolean(story),
    };
  }

  const ins = INSTALOADER_RE.exec(fileName);
  if (ins) {
    const [, postId, indexStr, story, ext] = ins;
    return {
      postId,
      date: postId.split('_')[0],
      username: '',
      index: indexStr ? parseInt(indexStr, 10) : 1,
      ext,
      isStory: Boolean(story),
    };
  }

  if (kind === 'highlight') {
    const hl = HIGHLIGHT_RE.exec(fileName);
    if (hl) {
      const [, username, shortcode, ext] = hl;
      return {
        postId: shortcode,
        date: mtime ? new Date(mtime).toISOString().split('T')[0] : '',
        username,
        index: 1,
        ext,
        isStory: false,
      };
    }
  }

  return null;
};

/**
 * Namespace a post ID by its source directory.
 *
 * Base-profile IDs are left untouched so existing permalinks keep working;
 * sidecar IDs are prefixed so a shortcode appearing in both the profile and a
 * highlight stays two distinct posts.
 */
export const scopedPostId = (postId: string, kind: SourceKind, dir?: string): string =>
  kind === 'posts' ? postId : `${dir ?? kind}/${postId}`;
