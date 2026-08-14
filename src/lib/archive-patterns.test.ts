import { describe, expect, it } from 'vitest';
import { parseArchiveFilename, scopedPostId } from './archive-patterns';

describe('parseArchiveFilename — Instagram export format', () => {
  it('parses a single-image post', () => {
    expect(parseArchiveFilename('2023-04-19_4utumn07 - CrORBIcJJbM.mp4')).toEqual({
      postId: 'CrORBIcJJbM',
      date: '2023-04-19',
      username: '4utumn07',
      index: 1,
      ext: 'mp4',
      isStory: false,
    });
  });

  it('parses a carousel slide index', () => {
    const parsed = parseArchiveFilename('2023-04-12_4utumn07 - Cq8LrxSJAJE - 3.jpg');
    expect(parsed).toMatchObject({ postId: 'Cq8LrxSJAJE', index: 3, ext: 'jpg' });
  });

  it('groups a carousel under one post id', () => {
    const ids = ['1', '2', '3'].map(
      n => parseArchiveFilename(`2023-04-12_user - Cq8LrxSJAJE - ${n}.jpg`)!.postId,
    );
    expect(new Set(ids).size).toBe(1);
  });

  it('parses caption sidecar files', () => {
    expect(parseArchiveFilename('2023-04-12_4utumn07 - Cq8LrxSJAJE.txt')).toMatchObject({
      postId: 'Cq8LrxSJAJE',
      ext: 'txt',
    });
  });

  it('flags an explicit story suffix', () => {
    expect(parseArchiveFilename('2023-04-12_user - ABC - story.jpg')?.isStory).toBe(true);
  });

  it('parses the story sidecar layout (date_user - N - shortcode)', () => {
    // Files in `story - <user>` carry a per-day ordinal before the shortcode.
    const parsed = parseArchiveFilename('2025-10-26_4utumn07 - 2 - DQRuDx9iW5Q.jpg', 'stories');
    expect(parsed).toMatchObject({ date: '2025-10-26', username: '4utumn07', ext: 'jpg' });
    expect(parsed!.postId).toContain('DQRuDx9iW5Q');
  });

  it('gives each story item a distinct id', () => {
    const a = parseArchiveFilename('2026-08-13_u - 1 - Db-UTJcCUUr.mp4', 'stories')!.postId;
    const b = parseArchiveFilename('2026-08-13_u - 2 - Db-oNJ1CWQ4.mp4', 'stories')!.postId;
    expect(a).not.toBe(b);
  });
});

describe('parseArchiveFilename — Instaloader format', () => {
  it('parses a timestamped filename', () => {
    expect(parseArchiveFilename('2024-01-01_12-00-00_UTC.jpg')).toMatchObject({
      postId: '2024-01-01_12-00-00_UTC',
      date: '2024-01-01',
      index: 1,
    });
  });

  it('parses the carousel suffix', () => {
    expect(parseArchiveFilename('2024-01-01_12-00-00_UTC_2.jpg')?.index).toBe(2);
  });

  it('flags the story suffix', () => {
    expect(parseArchiveFilename('2024-01-01_12-00-00_UTC_story.jpg')?.isStory).toBe(true);
  });
});

describe('parseArchiveFilename — story highlights', () => {
  it('parses the dateless highlight layout', () => {
    expect(parseArchiveFilename('4utumn07 - C5dQPEYpd9W.mp4', 'highlight')).toMatchObject({
      postId: 'C5dQPEYpd9W',
      username: '4utumn07',
      ext: 'mp4',
      isStory: false,
    });
  });

  it('dates a highlight from mtime when the filename has none', () => {
    const mtime = Date.UTC(2024, 4, 17, 12, 0, 0);
    expect(parseArchiveFilename('user - ABC.jpg', 'highlight', mtime)?.date).toBe('2024-05-17');
  });

  it('leaves the date empty when no mtime is available', () => {
    expect(parseArchiveFilename('user - ABC.jpg', 'highlight')?.date).toBe('');
  });

  it('does not apply the loose highlight pattern outside highlight directories', () => {
    // Would otherwise swallow ordinary "a - b.jpg" filenames.
    expect(parseArchiveFilename('user - ABC.jpg', 'posts')).toBeNull();
  });
});

describe('parseArchiveFilename — non-matching files', () => {
  it.each(['4utumn07.jpg', 'profile_pic.jpg', 'README.md', 'no-separator.png'])(
    'returns null for %s',
    name => expect(parseArchiveFilename(name)).toBeNull(),
  );
});

describe('scopedPostId', () => {
  it('leaves base-profile ids untouched so permalinks keep working', () => {
    expect(scopedPostId('Cq8LrxSJAJE', 'posts')).toBe('Cq8LrxSJAJE');
  });

  it('namespaces sidecar ids by directory', () => {
    expect(scopedPostId('C5dQ', 'highlight', 'story highlights - u - Sunstory'))
      .toBe('story highlights - u - Sunstory/C5dQ');
  });

  it('keeps the same shortcode distinct across sources', () => {
    const inPosts = scopedPostId('ABC', 'posts');
    const inHighlight = scopedPostId('ABC', 'highlight', 'story highlights - u - H');
    expect(inPosts).not.toBe(inHighlight);
  });
});
