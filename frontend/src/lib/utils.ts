import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

export function marketplaceColor(mp: string) {
  return mp === 'GOFOOD' ? '#00AA5B' : mp === 'GRABFOOD' ? '#00B14F' : '#EE4D2D';
}

export function marketplaceLabel(mp: string) {
  return mp === 'GOFOOD' ? 'GoFood' : mp === 'GRABFOOD' ? 'GrabFood' : 'ShopeeFood';
}

/** Local YYYY-MM-DD (avoid UTC shift from toISOString). */
export function toLocalDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function thisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toLocalDateString(from), to: toLocalDateString(to) };
}

/** @deprecated Prefer yearToDateRange / usePeriod from `@/lib/period`. */
export function yearToDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  return { from: toLocalDateString(from), to: toLocalDateString(now) };
}
