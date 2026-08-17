import { describe, expect, it } from 'vitest';
import { DatedValue, preferDate, shouldReplaceDate } from './post-dates';

const sidecar: DatedValue = { date: '2024-04-07', source: 'sidecar' };
const filename: DatedValue = { date: '2024-04-08', source: 'filename' };
const mtime: DatedValue = { date: '2026-08-17', source: 'mtime' };

describe('date precedence', () => {
  it('ranks sidecar above filename above mtime', () => {
    expect(preferDate(mtime, filename)).toEqual(filename);
    expect(preferDate(filename, sidecar)).toEqual(sidecar);
    expect(preferDate(mtime, sidecar)).toEqual(sidecar);
  });

  it('never lets a weaker source overwrite a stronger one', () => {
    expect(preferDate(sidecar, filename)).toEqual(sidecar);
    expect(preferDate(sidecar, mtime)).toEqual(sidecar);
    expect(preferDate(filename, mtime)).toEqual(filename);
  });

  it('keeps the incumbent on a tie, so scan order cannot flip the date', () => {
    const other: DatedValue = { date: '2020-01-01', source: 'filename' };
    expect(preferDate(filename, other)).toEqual(filename);
    expect(preferDate(other, filename)).toEqual(other);
  });

  it('accepts anything when nothing is held yet', () => {
    expect(preferDate(undefined, mtime)).toEqual(mtime);
    expect(shouldReplaceDate(undefined, mtime)).toBe(true);
  });

  it('ignores an empty date regardless of source', () => {
    const empty: DatedValue = { date: '', source: 'sidecar' };
    expect(shouldReplaceDate(filename, empty)).toBe(false);
    expect(preferDate(filename, empty)).toEqual(filename);
  });

  it('replaces a held-but-empty date', () => {
    const empty: DatedValue = { date: '', source: 'filename' };
    expect(preferDate(empty, mtime)).toEqual(mtime);
  });

  it('is order-independent for the full three-source case', () => {
    const orders = [
      [mtime, filename, sidecar],
      [sidecar, mtime, filename],
      [filename, sidecar, mtime],
      [mtime, sidecar, filename],
    ];
    for (const order of orders) {
      const won = order.reduce<DatedValue | undefined>(
        (acc, next) => preferDate(acc, next), undefined);
      expect(won).toEqual(sidecar);
    }
  });
});
