import { describe, expect, it } from 'vitest';
import { buildPath, findPostBySlug, parseRoute, postSlug, tabForSource } from './routing';
import { Post } from '../types';

const post = (id: string, source?: Post['source']): Post => ({
  id, date: '2024-01-01', username: 'u', caption: '', media: [], thumbnail: '', source,
});

describe('parseRoute', () => {
  it('reads the explorer root', () => {
    expect(parseRoute('/')).toEqual({ archive: null, tab: 'posts', post: null });
  });

  it('reads a profile', () => {
    expect(parseRoute('/4utumn07/')).toEqual({ archive: '4utumn07', tab: 'posts', post: null });
  });

  it('reads a profile without a trailing slash', () => {
    expect(parseRoute('/4utumn07')).toEqual({ archive: '4utumn07', tab: 'posts', post: null });
  });

  it('reads a tab', () => {
    expect(parseRoute('/4utumn07/reels/').tab).toBe('reels');
    expect(parseRoute('/4utumn07/saved/').tab).toBe('saved');
  });

  it('reads a post in Instagram form', () => {
    expect(parseRoute('/4utumn07/p/Db5tIoRCcvm/')).toEqual({
      archive: '4utumn07', tab: 'posts', post: 'Db5tIoRCcvm',
    });
  });

  it('decodes archive names containing spaces', () => {
    expect(parseRoute('/Heejin_Bubble%20heejinmedia/').archive).toBe('Heejin_Bubble heejinmedia');
  });

  it('does not treat reserved prefixes as archives', () => {
    for (const path of ['/api/archives', '/archives/x/y.jpg', '/assets/index.js']) {
      expect(parseRoute(path).archive).toBeNull();
    }
  });

  it('still understands the legacy query form', () => {
    expect(parseRoute('/', '?a=4utumn07&t=reels&p=ABC')).toEqual({
      archive: '4utumn07', tab: 'reels', post: 'ABC',
    });
  });

  it('ignores an unknown tab', () => {
    expect(parseRoute('/', '?a=u&t=bogus').tab).toBe('posts');
  });
});

describe('buildPath', () => {
  it.each([
    [{ archive: null, tab: 'posts', post: null }, '/'],
    [{ archive: '4utumn07', tab: 'posts', post: null }, '/4utumn07/'],
    [{ archive: '4utumn07', tab: 'reels', post: null }, '/4utumn07/reels/'],
    [{ archive: '4utumn07', tab: 'posts', post: 'Db5tIoRCcvm' }, '/4utumn07/p/Db5tIoRCcvm/'],
  ] as const)('builds %j', (route, expected) => {
    expect(buildPath(route as any)).toBe(expected);
  });

  it('omits the tab from a post URL, matching Instagram', () => {
    expect(buildPath({ archive: 'u', tab: 'reels', post: 'ABC' })).toBe('/u/p/ABC/');
  });

  it('encodes archive names with spaces', () => {
    expect(buildPath({ archive: 'a b', tab: 'posts', post: null })).toBe('/a%20b/');
  });

  it('round-trips through parseRoute', () => {
    for (const route of [
      { archive: '4utumn07', tab: 'posts' as const, post: null },
      { archive: '4utumn07', tab: 'reels' as const, post: null },
      { archive: 'Heejin_Bubble heejinmedia', tab: 'posts' as const, post: null },
    ]) {
      expect(parseRoute(buildPath(route))).toEqual(route);
    }
  });
});

describe('postSlug / findPostBySlug', () => {
  it('uses the bare shortcode for base posts', () => {
    expect(postSlug(post('Db5tIoRCcvm'))).toBe('Db5tIoRCcvm');
  });

  it('strips the sidecar directory from the slug', () => {
    expect(postSlug(post('story highlights - u - Sunstory/C5dQPEYpd9W'))).toBe('C5dQPEYpd9W');
  });

  it('resolves a slug back to its post', () => {
    const posts = [post('AAA'), post('4utumn07 - reels/BBB', 'reels')];
    expect(findPostBySlug(posts, 'BBB')?.id).toBe('4utumn07 - reels/BBB');
    expect(findPostBySlug(posts, 'AAA')?.id).toBe('AAA');
  });

  it('prefers an exact id match over a shortcode match', () => {
    const posts = [post('x/ABC'), post('ABC')];
    expect(findPostBySlug(posts, 'ABC')?.id).toBe('ABC');
  });

  it('returns undefined for an unknown slug', () => {
    expect(findPostBySlug([post('AAA')], 'ZZZ')).toBeUndefined();
  });
});

describe('tabForSource', () => {
  it('sends reels to the reels tab and everything else to posts', () => {
    expect(tabForSource('reels')).toBe('reels');
    expect(tabForSource('posts')).toBe('posts');
    expect(tabForSource(undefined)).toBe('posts');
  });
});
