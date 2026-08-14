import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an archive date, tolerating junk.
 *
 * Dates are derived from filenames and arbitrary archive JSON, and date-fns
 * `format` throws a RangeError on an invalid date — which would take down the
 * whole modal for one malformed name. Story highlights in particular carry no
 * date at all when file mtimes are unavailable.
 */
export function formatDateSafe(date: string | undefined, pattern: string): string {
  if (!date) return '';
  try {
    const parsed = parseISO(date);
    if (Number.isNaN(parsed.getTime())) return '';
    return format(parsed, pattern);
  } catch {
    return '';
  }
}
