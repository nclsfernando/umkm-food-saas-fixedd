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

export function thisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { from, to };
}
