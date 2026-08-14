import { Post, SourceKind } from '../types';

/**
 * Instagram-shaped paths.
 *
 *   /                          the archive explorer
 *   /<archive>/                a profile, posts tab
 *   /<archive>/reels/          a profile, reels tab
 *   /<archive>/saved/
 *   /<archive>/p/<shortcode>/  a single post
 *
 * The older `?a=&t=&p=` query form is still parsed so existing links keep
 * working; it is never written back.
 */

export type Tab = 'posts' | 'reels' | 'saved';

const TABS: Tab[] = ['posts', 'reels', 'saved'];

/**
 * Path prefixes the app must never treat as an archive name, or a profile
 * called "api" would shadow the backend.
 */
const RESERVED = new Set(['api', 'archives', 'assets', 'p', 'fonts', 'sw.js', 'manifest.webmanifest']);

export interface Route {
  archive: string | null;
  tab: Tab;
  /** Post shortcode, i.e. the trailing segment of a post id. */
  post: string | null;
}

/**
 * A post's URL slug.
 *
 * Sidecar posts carry a directory-scoped id (`story highlights - u - H/ABC`)
 * so ids stay unique across sources, but only the shortcode belongs in a URL.
 */
export const postSlug = (post: Pick<Post, 'id'>): string => {
  const tail = post.id.split('/').pop() ?? post.id;
  return encodeURIComponent(tail);
};

/** Find the post a slug refers to, preferring an exact id match. */
export const findPostBySlug = (posts: Post[], slug: string): Post | undefined => {
  const decoded = decodeURIComponent(slug);
  return posts.find(p => p.id === decoded)
    ?? posts.find(p => (p.id.split('/').pop() ?? p.id) === decoded);
};

/** Which tab shows a given post, so a deep link lands on the right one. */
export const tabForSource = (source?: SourceKind): Tab => (source === 'reels' ? 'reels' : 'posts');

export const parseRoute = (pathname: string, search = ''): Route => {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (segments.length && !RESERVED.has(segments[0])) {
    const [archive, second, third] = segments;

    if (second === 'p' && third) return { archive, tab: 'posts', post: third };
    if (second && TABS.includes(second as Tab)) return { archive, tab: second as Tab, post: null };
    return { archive, tab: 'posts', post: null };
  }

  // Legacy query form: ?a=<archive>&t=<tab>&p=<post id>
  const params = new URLSearchParams(search);
  const archive = params.get('a');
  const tab = params.get('t');
  return {
    archive: archive || null,
    tab: tab && TABS.includes(tab as Tab) ? (tab as Tab) : 'posts',
    post: params.get('p'),
  };
};

export const buildPath = ({ archive, tab, post }: Route): string => {
  if (!archive) return '/';

  const base = `/${encodeURIComponent(archive)}`;
  // A post URL omits the tab, matching Instagram; the tab is re-derived from
  // the post itself when the link is opened.
  if (post) return `${base}/p/${post}/`;
  if (tab !== 'posts') return `${base}/${tab}/`;
  return `${base}/`;
};
