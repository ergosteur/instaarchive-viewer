import { Post, SourceKind } from '../types';
import { Tab } from './routing';

/**
 * Which posts each profile tab shows.
 *
 * Instagram's profile grid holds everything the account posted — photos,
 * carousels and reels alike — and the Reels tab is a *filtered view* of that
 * same set rather than a separate one. So a reel belongs in both tabs, and
 * only the Reels tab does any filtering.
 *
 * Kept pure and separate from App.tsx so the reel heuristic and the
 * duplicate-copy rules can be tested directly.
 */

/**
 * The shortcode shared by every copy of a post, regardless of which source
 * directory it came from. Sidecar ids are directory-scoped
 * (`4utumn07 - reels/Cq8LrxSJAJE`); the trailing segment is the shortcode.
 */
const shortcode = (post: Post): string => post.id.split('/').pop() ?? post.id;

/**
 * True when the archive has a `- reels` sidecar directory, i.e. it states
 * outright which posts are reels.
 */
export const hasReelSource = (posts: Post[]): boolean => posts.some(p => p.source === 'reels');

/**
 * Build the reel test for an archive.
 *
 * Instagram's own marker is `product_type: "clips"` on the post's GraphQL
 * node, but only Instaloader archives carry that metadata, and only on newer
 * captures — JDownloader grabs are media plus a caption `.txt` and nothing
 * else (see docs/jdownloader.md). So:
 *
 *   - archives with a `- reels` directory are believed outright;
 *   - everything else falls back to treating a lone video as a reel.
 *
 * The fallback is a guess: it cannot tell a reel from an ordinary feed video
 * or an old IGTV upload, all three of which are plain `GraphVideo` nodes
 * distinguished only by `product_type`.
 */
export const makeIsReel = (posts: Post[]): ((post: Post) => boolean) => (
  hasReelSource(posts)
    ? (post: Post) => post.source === 'reels'
    : (post: Post) => post.media.length === 1 && post.media[0]?.type === 'video'
);

/** Preference order when the same post was fetched into more than one directory. */
const SOURCE_RANK: Record<SourceKind, number> = { reels: 0, posts: 1, stories: 2, highlight: 3 };

const rankOf = (post: Post): number => SOURCE_RANK[post.source ?? 'posts'];

/**
 * Collapse copies of one post that were fetched into more than one directory.
 *
 * The JDownloader flow crawls a profile URL and its `/reels/` URL separately
 * because the profile page misses some reels — so the two overlap, and a reel
 * present in both lands on disk twice. Those become two posts with distinct
 * directory-scoped ids, which the grid would happily render side by side.
 *
 * The reels-source copy wins, so the surviving post still reports
 * `source: 'reels'` and both the Reels tab and `tabForSource` recognise it.
 *
 * Only safe because callers pass the grid's posts, which exclude stories and
 * highlights — a shortcode may legitimately appear in both the profile and a
 * highlight, and those must stay distinct.
 */
export const dedupePostCopies = (posts: Post[]): Post[] => {
  const winners = new Map<string, Post>();

  for (const post of posts) {
    const code = shortcode(post);
    const existing = winners.get(code);
    if (!existing || rankOf(post) < rankOf(existing)) winners.set(code, post);
  }

  // Preserve input order, keyed on the winner so ordering does not depend on
  // which copy happened to be scanned first.
  const emitted = new Set<string>();
  const result: Post[] = [];
  for (const post of posts) {
    const code = shortcode(post);
    if (emitted.has(code)) continue;
    emitted.add(code);
    result.push(winners.get(code)!);
  }
  return result;
};

/**
 * The posts a tab displays.
 *
 * `posts` must already exclude stories and highlights (App passes `allPosts`).
 */
export const postsForTab = (posts: Post[], tab: Tab): Post[] => {
  if (tab === 'saved') return [];

  const unique = dedupePostCopies(posts);
  if (tab === 'posts') return unique;
  return unique.filter(makeIsReel(posts));
};
