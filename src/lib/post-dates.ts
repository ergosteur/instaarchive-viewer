/**
 * Where a post's date came from, and which source wins.
 *
 * A post is usually described by several files — media, a caption `.txt`, a
 * `.json` sidecar, sometimes the same item under two naming conventions — and
 * they are scanned in directory order, not in order of trustworthiness. Without
 * an explicit ranking the date is decided by whichever file happened to be
 * reached first.
 *
 * Ranked best to worst:
 *
 *   sidecar   what Instagram reported, straight from a gallery-dl `.json`
 *   filename  a date the fetcher wrote into the name; correct, but derived
 *   mtime     when the file was written to disk — unrelated to when it was
 *             posted, and only ever a last resort for JDownloader highlights,
 *             whose filenames carry no date at all
 */
export type DateSource = 'sidecar' | 'filename' | 'mtime';

const RANK: Record<DateSource, number> = { sidecar: 0, filename: 1, mtime: 2 };

export interface DatedValue {
  date: string;
  source: DateSource;
}

/**
 * Whether `next` should replace the date currently held.
 *
 * Ties keep the incumbent, so scanning stays stable: two files of equal
 * authority cannot flip a post's date back and forth by scan order.
 */
export const shouldReplaceDate = (
  current: DatedValue | undefined,
  next: DatedValue,
): boolean => {
  if (!next.date) return false;
  if (!current || !current.date) return true;
  return RANK[next.source] < RANK[current.source];
};

/** Apply `next` if it outranks `current`, otherwise keep what we have. */
export const preferDate = (
  current: DatedValue | undefined,
  next: DatedValue,
): DatedValue => (shouldReplaceDate(current, next) ? next : (current ?? next));
