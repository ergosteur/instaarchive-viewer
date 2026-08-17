import { SourceKind } from '../types';

/**
 * gallery-dl `.json` metadata sidecars.
 *
 * Written one per post next to the media (see docs/gallery-dl.md). This is the
 * only source in any archive format that states outright what a post *is* —
 * `type` is Instagram's own classification, the `product_type: "clips"` signal
 * carried through the listing response. Everything else the viewer knows about
 * reels is guesswork from filenames and directory names.
 *
 * Deliberately separate from the two older JSON shapes the scanner reads:
 *
 *   Instagram export   `posts_1.json`, an array of entries with `media`
 *   Instaloader        `.json.xz`, a GraphQL node under `node`
 *   gallery-dl         this — flat, no wrapper
 */
export interface GalleryDlSidecar {
  post_shortcode: string;
  post_id?: string;
  /** Instagram's own classification of the post. */
  type?: 'post' | 'reel' | 'story' | 'highlight';
  /** Local-time "YYYY-MM-DD HH:MM:SS" — gallery-dl is configured to emit local. */
  date?: string;
  post_date?: string;
  username?: string;
  fullname?: string;
  description?: string;
  count?: number;
  likes?: number;
  post_url?: string;
}

/**
 * Recognise a gallery-dl sidecar.
 *
 * Checked structurally rather than by filename, because the older formats are
 * also plain `.json`. `node` and `__typename` are what an Instaloader or
 * export payload carries, and their absence is what makes this shape
 * unambiguous.
 */
export const isGalleryDlSidecar = (data: unknown): data is GalleryDlSidecar => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const o = data as Record<string, unknown>;
  return typeof o.post_shortcode === 'string'
    && typeof o.type === 'string'
    && o.node === undefined
    && o.__typename === undefined
    && o.media === undefined;
};

/** The ISO date (YYYY-MM-DD) a sidecar reports, or '' if it carries none. */
export const sidecarDate = (s: GalleryDlSidecar): string => {
  const raw = s.date || s.post_date || '';
  const day = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
};

/**
 * Whether the sidecar says this post is a reel.
 *
 * Returns undefined rather than false for stories and highlights: those are
 * neither reels nor grid posts, and answering "no" would let them be counted
 * as ordinary posts.
 */
export const sidecarIsReel = (s: GalleryDlSidecar): boolean | undefined => {
  if (s.type === 'reel') return true;
  if (s.type === 'post') return false;
  return undefined;
};

/**
 * Which source kind the sidecar implies, for cross-checking the directory.
 *
 * A reel shared to the profile grid legitimately appears under `posts`, so a
 * disagreement is not an error — the directory says where the file was
 * fetched from, `type` says what Instagram considers it.
 */
export const sidecarSource = (s: GalleryDlSidecar): SourceKind | undefined => {
  switch (s.type) {
    case 'reel': return 'reels';
    case 'post': return 'posts';
    case 'story': return 'stories';
    case 'highlight': return 'highlight';
    default: return undefined;
  }
};
