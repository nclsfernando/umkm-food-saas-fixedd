import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UMKM Food — Laporan Keuangan GoFood, GrabFood, ShopeeFood',
  description: 'Aplikasi laporan keuangan untuk UMKM kuliner online',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
