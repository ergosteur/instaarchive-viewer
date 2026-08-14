import { describe, expect, it } from 'vitest';
import { isSystemDirectory } from './archive-index';

describe('isSystemDirectory', () => {
  it.each([
    ['@eaDir', 'Synology thumbnail/index metadata, written inside every folder'],
    ['@tmp', 'Synology scratch'],
    ['.sync', 'Resilio state'],
    ['.DS_Store', 'macOS'],
    ['#recycle', 'Synology deletions'],
    ['#snapshot', 'Synology snapshots'],
  ])('skips %s (%s)', name => {
    expect(isSystemDirectory(name)).toBe(true);
  });

  it.each([
    '4utumn07',
    '4utumn07 - reels',
    'story - dawn_petal',
    'story highlights - official_band - A.B.C',
    'story highlights - theoldlyricmuseinsta - 💙1999-2005 era',
    'Heejin_Bubble heejinmedia',
    'gallery-dl',
    'posts',
  ])('keeps %s', name => {
    expect(isSystemDirectory(name)).toBe(false);
  });

  it('does not treat a leading underscore as a system directory', () => {
    // `_gemini-plans` is filtered separately at the archive root only; nothing
    // below the root should be excluded just for starting with an underscore.
    expect(isSystemDirectory('_gemini-plans')).toBe(false);
  });
});
