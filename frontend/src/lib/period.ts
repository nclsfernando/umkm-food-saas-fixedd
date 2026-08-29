import { toLocalDateString } from '@/lib/utils';

export const PERIOD_STORAGE_KEY = 'umkm-period';
export const PERIOD_CHANGE_EVENT = 'umkm-period-change';

export type PeriodRange = { from: string; to: string };

export function isValidYmd(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Default: start of current year → today (covers imported Grab/GoFood months). */
export function yearToDateRange(): PeriodRange {
  const now = new Date();
  return {
    from: toLocalDateString(new Date(now.getFullYear(), 0, 1)),
    to: toLocalDateString(now),
  };
}

export function formatPeriodLabel(from: string, to: string) {
  return `Periode: ${from} s/d ${to}`;
}

export function readStoredPeriod(): PeriodRange | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PeriodRange>;
    if (isValidYmd(parsed.from) && isValidYmd(parsed.to)) {
      return { from: parsed.from, to: parsed.to };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredPeriod(range: PeriodRange) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(range));
  window.dispatchEvent(new CustomEvent(PERIOD_CHANGE_EVENT, { detail: range }));
}

/** Resolve period: URL query → localStorage → year-to-date. */
export function resolvePeriod(search?: string): PeriodRange {
  const params = new URLSearchParams(search ?? (typeof window !== 'undefined' ? window.location.search : ''));
  const qFrom = params.get('from');
  const qTo = params.get('to');
  if (isValidYmd(qFrom) && isValidYmd(qTo)) return { from: qFrom, to: qTo };
  return readStoredPeriod() ?? yearToDateRange();
}

export function periodQueryString(range: PeriodRange) {
  return `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
}

export function hrefWithPeriod(href: string, range: PeriodRange | null) {
  if (!range) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}${periodQueryString(range)}`;
}

/** Local calendar day bounds (avoids UTC midnight truncating the `to` date). */
export function parseDayStart(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export function parseDayEnd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}
