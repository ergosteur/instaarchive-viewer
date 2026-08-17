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
  /**
   * True when `date` is the file's mtime rather than anything Instagram said.
   *
   * Only highlights fetched by JDownloader lack a date in the filename, and
   * their mtime is just when the file was written. Callers should let any real
   * date win over this one — the same item is often also present under a
   * gallery-dl name that does carry the date.
   */
  dateFromMtime: boolean;
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
      dateFromMtime: false,
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
      dateFromMtime: false,
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
        dateFromMtime: Boolean(mtime),
      };
    }
  }

  return null;
};

/**
 * A leading per-day ordinal on a story or highlight id: `01 - C5dQPEYpd9W`.
 *
 * JDownloader wrote story-shaped names for highlights during one period of its
 * life, so the same item exists as both `user - CODE.jpg` and
 * `date_user - 01 - CODE.jpg`. Those parse to different ids and the viewer
 * shows the item twice. The ordinal carries no information the shortcode does
 * not — it is a position within a day's stories, and the shortcode is already
 * unique — so it is dropped.
 */
const LEADING_ORDINAL = /^\d+ - (?=[A-Za-z0-9_-]+$)/;

/** Strip the ordinal so both naming conventions land on the same post. */
export const canonicalItemId = (postId: string): string =>
  postId.replace(LEADING_ORDINAL, '');

/**
 * Namespace a post ID by its source directory.
 *
 * Base-profile IDs are left untouched so existing permalinks keep working;
 * sidecar IDs are prefixed so a shortcode appearing in both the profile and a
 * highlight stays two distinct posts.
 *
 * Story and highlight ids are canonicalised first, so an item fetched under
 * two different naming conventions is one post rather than two.
 */
export const scopedPostId = (postId: string, kind: SourceKind, dir?: string): string => {
  if (kind === 'posts') return postId;
  const id = (kind === 'stories' || kind === 'highlight')
    ? canonicalItemId(postId)
    : postId;
  return `${dir ?? kind}/${id}`;
};
