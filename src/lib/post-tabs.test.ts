import { describe, expect, it } from 'vitest';
import { dedupePostCopies, hasReelSource, makeIsReel, postsForTab } from './post-tabs';
import { MediaFile, Post } from '../types';

const media = (type: MediaFile['type'], index = 1): MediaFile => ({
  name: `f${index}.${type === 'video' ? 'mp4' : 'jpg'}`,
  path: `d/f${index}`, url: '', type, index,
});

const post = (id: string, opts: Partial<Post> = {}): Post => ({
  id, date: '2024-01-01', username: 'u', caption: '', media: [media('image')], thumbnail: '', ...opts,
});

const video = (id: string, opts: Partial<Post> = {}) => post(id, { media: [media('video')], ...opts });
const carousel = (id: string, opts: Partial<Post> = {}) =>
  post(id, { media: [media('image', 1), media('video', 2)], ...opts });

describe('hasReelSource', () => {
  it('is false for an archive with no reels directory', () => {
    expect(hasReelSource([post('A'), video('B')])).toBe(false);
  });

  it('is true once any post came from a reels directory', () => {
    expect(hasReelSource([post('A'), video('u - reels/B', { source: 'reels' })])).toBe(true);
  });
});

describe('makeIsReel', () => {
  it('believes the reels directory when there is one', () => {
    const posts = [video('A'), video('u - reels/B', { source: 'reels' })];
    const isReel = makeIsReel(posts);
    // A is a lone video too, but the archive states which posts are reels.
    expect(isReel(posts[0])).toBe(false);
    expect(isReel(posts[1])).toBe(true);
  });

  it('falls back to the lone-video heuristic without one', () => {
    const posts = [post('A'), video('B'), carousel('C')];
    const isReel = makeIsReel(posts);
    expect(posts.map(isReel)).toEqual([false, true, false]);
  });
});

describe('dedupePostCopies', () => {
  it('leaves distinct posts alone', () => {
    const posts = [post('A'), video('B')];
    expect(dedupePostCopies(posts).map(p => p.id)).toEqual(['A', 'B']);
  });

  it('collapses a reel fetched into both the profile and the reels directory', () => {
    const posts = [video('B'), video('u - reels/B', { source: 'reels' })];
    const deduped = dedupePostCopies(posts);
    expect(deduped).toHaveLength(1);
    // The reels copy wins, so the survivor is still recognised as a reel.
    expect(deduped[0].source).toBe('reels');
  });

  it('picks the reels copy regardless of scan order', () => {
    const profileCopy = video('B');
    const reelCopy = video('u - reels/B', { source: 'reels' });
    expect(dedupePostCopies([profileCopy, reelCopy])[0].source).toBe('reels');
    expect(dedupePostCopies([reelCopy, profileCopy])[0].source).toBe('reels');
  });

  it('keeps the position of the first copy seen', () => {
    const posts = [post('A'), video('B'), post('C'), video('u - reels/B', { source: 'reels' })];
    expect(dedupePostCopies(posts).map(p => p.id.split('/').pop())).toEqual(['A', 'B', 'C']);
  });
});

describe('postsForTab', () => {
  it('shows reels in the profile grid, as Instagram does', () => {
    const posts = [post('A'), video('u - reels/B', { source: 'reels' })];
    expect(postsForTab(posts, 'posts').map(p => p.id)).toEqual(['A', 'u - reels/B']);
  });

  it('shows the same reel in both tabs', () => {
    const posts = [post('A'), video('u - reels/B', { source: 'reels' })];
    const inGrid = postsForTab(posts, 'posts').map(p => p.id);
    const inReels = postsForTab(posts, 'reels').map(p => p.id);
    expect(inReels).toEqual(['u - reels/B']);
    expect(inGrid).toContain('u - reels/B');
  });

  it('shows a duplicated reel once in the grid, not twice', () => {
    const posts = [post('A'), video('B'), video('u - reels/B', { source: 'reels' })];
    expect(postsForTab(posts, 'posts')).toHaveLength(2);
    expect(postsForTab(posts, 'reels')).toHaveLength(1);
  });

  it('treats lone videos as reels for archives with no reels directory', () => {
    const posts = [post('A'), video('B'), carousel('C')];
    expect(postsForTab(posts, 'posts').map(p => p.id)).toEqual(['A', 'B', 'C']);
    expect(postsForTab(posts, 'reels').map(p => p.id)).toEqual(['B']);
  });

  it('has nothing saved', () => {
    expect(postsForTab([post('A')], 'saved')).toEqual([]);
  });
});
