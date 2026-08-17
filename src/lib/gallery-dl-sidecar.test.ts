import { describe, expect, it } from 'vitest';
import {
  GalleryDlSidecar, isGalleryDlSidecar, sidecarDate, sidecarIsReel, sidecarSource,
} from './gallery-dl-sidecar';

// Trimmed from real files published to the archive on 2026-08-16.
const REEL: GalleryDlSidecar = {
  post_shortcode: 'Db-lNCoib9m', post_id: '3962768346034323302', type: 'reel',
  date: '2026-08-13 11:00:44', post_date: '2026-08-13 11:00:44',
  username: 'official_band', fullname: 'Official ARTMS',
  description: 'Dancing in the spotlight', count: 1, likes: 22914,
};
const FEED_VIDEO: GalleryDlSidecar = { ...REEL, post_shortcode: 'DbdG9L9jU4m', type: 'post', count: 2 };
const HIGHLIGHT: GalleryDlSidecar = {
  post_shortcode: 'BATVdRZi_3', post_id: '18099435932626935', type: 'highlight',
  date: '2026-08-08 16:22:09', username: 'official_band', count: 154,
};

describe('isGalleryDlSidecar', () => {
  it('accepts a real sidecar', () => {
    expect(isGalleryDlSidecar(REEL)).toBe(true);
    expect(isGalleryDlSidecar(HIGHLIGHT)).toBe(true);
  });

  it('rejects an Instaloader GraphQL payload', () => {
    expect(isGalleryDlSidecar({ node: { __typename: 'GraphVideo', shortcode: 'x' } })).toBe(false);
    expect(isGalleryDlSidecar({ __typename: 'GraphImage', post_shortcode: 'x', type: 'post' })).toBe(false);
  });

  it('rejects an Instagram export manifest', () => {
    expect(isGalleryDlSidecar({ media: [{ uri: 'a.jpg' }] })).toBe(false);
    expect(isGalleryDlSidecar([{ media: [] }])).toBe(false);
  });

  it('rejects junk', () => {
    for (const v of [null, undefined, 0, '', 'string', {}, { post_shortcode: 'x' }]) {
      expect(isGalleryDlSidecar(v)).toBe(false);
    }
  });
});

describe('sidecarDate', () => {
  it('takes the day from the timestamp', () => {
    expect(sidecarDate(REEL)).toBe('2026-08-13');
  });

  it('falls back to post_date', () => {
    expect(sidecarDate({ post_shortcode: 'x', post_date: '2024-01-02 03:04:05' })).toBe('2024-01-02');
  });

  it('returns empty when there is no usable date', () => {
    expect(sidecarDate({ post_shortcode: 'x' })).toBe('');
    expect(sidecarDate({ post_shortcode: 'x', date: 'not a date' })).toBe('');
  });
});

describe('sidecarIsReel', () => {
  it('distinguishes a reel from an ordinary feed video', () => {
    // Both are single mp4s -- the lone-video heuristic cannot tell them apart.
    expect(sidecarIsReel(REEL)).toBe(true);
    expect(sidecarIsReel(FEED_VIDEO)).toBe(false);
  });

  it('declines to answer for stories and highlights', () => {
    expect(sidecarIsReel(HIGHLIGHT)).toBeUndefined();
    expect(sidecarIsReel({ post_shortcode: 'x', type: 'story' as const })).toBeUndefined();
    expect(sidecarIsReel({ post_shortcode: 'x' })).toBeUndefined();
  });
});

describe('sidecarSource', () => {
  it('maps type onto the archive source kinds', () => {
    expect(sidecarSource(REEL)).toBe('reels');
    expect(sidecarSource(FEED_VIDEO)).toBe('posts');
    expect(sidecarSource(HIGHLIGHT)).toBe('highlight');
    expect(sidecarSource({ post_shortcode: 'x', type: 'story' as const })).toBe('stories');
  });

  it('is undefined for an unknown type', () => {
    expect(sidecarSource({ post_shortcode: 'x' })).toBeUndefined();
  });
});
