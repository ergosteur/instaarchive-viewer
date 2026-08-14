import { describe, expect, it } from 'vitest';
import { classifyDirectory, groupArchiveDirectories } from './archive-grouping';

describe('classifyDirectory', () => {
  it('treats a bare profile directory as the base', () => {
    expect(classifyDirectory('4utumn07')).toEqual({
      owner: '4utumn07',
      source: { kind: 'posts', dir: '4utumn07' },
    });
  });

  it('recognises a reels sidecar', () => {
    expect(classifyDirectory('4utumn07 - reels')).toEqual({
      owner: '4utumn07',
      source: { kind: 'reels', dir: '4utumn07 - reels' },
    });
  });

  it('recognises a stories sidecar', () => {
    expect(classifyDirectory('story - dawn_petal')).toEqual({
      owner: 'dawn_petal',
      source: { kind: 'stories', dir: 'story - dawn_petal' },
    });
  });

  it('splits highlight owner from title', () => {
    const { owner, source } = classifyDirectory('story highlights - 4utumn07 - Sunstory');
    expect(owner).toBe('4utumn07');
    expect(source.kind).toBe('highlight');
    expect(source.title).toBe('Sunstory');
  });

  it.each([
    ['story highlights - theoldlyricmuseinsta - 💙1999-2005 era', 'theoldlyricmuseinsta', '💙1999-2005 era'],
    ['story highlights - member_theworld - [Bracket]', 'member_theworld', '[Bracket]'],
    ['story highlights - official_band - Tour Schedule', 'official_band', 'Tour Schedule'],
    ['story highlights - 4utumn07 - Sketching⠀', '4utumn07', 'Sketching⠀'],
    ['story highlights - official_band - A.B.C', 'official_band', 'A.B.C'],
  ])('handles real-world title %s', (dir, owner, title) => {
    const result = classifyDirectory(dir);
    expect(result.owner).toBe(owner);
    expect(result.source.title).toBe(title);
  });

  it('keeps titles containing " - " intact', () => {
    // The username is matched as a non-space run, so only the first separator
    // splits owner from title.
    const { owner, source } = classifyDirectory('story highlights - user - a - b');
    expect(owner).toBe('user');
    expect(source.title).toBe('a - b');
  });

  it('does not mistake a profile with spaces for a sidecar', () => {
    expect(classifyDirectory('Heejin_Bubble heejinmedia').source.kind).toBe('posts');
  });
});

describe('groupArchiveDirectories', () => {
  const dirs = [
    '4utumn07',
    '4utumn07 - reels',
    'story - 4utumn07',
    'story highlights - 4utumn07 - Sunstory',
    'story highlights - 4utumn07 - Sketching⠀',
    'kestrelsings',
  ];

  it('folds sidecars into their base profile', () => {
    const groups = groupArchiveDirectories(dirs);
    expect([...groups.keys()].sort()).toEqual(['4utumn07', 'kestrelsings']);
    expect(groups.get('4utumn07')).toHaveLength(5);
    expect(groups.get('kestrelsings')).toHaveLength(1);
  });

  it('orders sources posts, reels, stories, then highlights by title', () => {
    const sources = groupArchiveDirectories(dirs).get('4utumn07')!;
    expect(sources.map(s => s.kind)).toEqual(['posts', 'reels', 'stories', 'highlight', 'highlight']);
    expect(sources.slice(3).map(s => s.title)).toEqual(['Sketching⠀', 'Sunstory']);
  });

  it('still groups a sidecar whose base profile is missing', () => {
    const groups = groupArchiveDirectories(['story - orphan']);
    expect(groups.get('orphan')).toEqual([{ kind: 'stories', dir: 'story - orphan' }]);
  });

  it('is stable for an empty archive root', () => {
    expect(groupArchiveDirectories([]).size).toBe(0);
  });
});
