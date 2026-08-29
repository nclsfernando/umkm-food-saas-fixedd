'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Package, Receipt, FileText, Upload, BarChart2, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PERIOD_CHANGE_EVENT,
  PERIOD_STORAGE_KEY,
  hrefWithPeriod,
  readStoredPeriod,
  type PeriodRange,
} from '@/lib/period';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Pesanan', icon: ShoppingBag },
  { href: '/products', label: 'Produk', icon: Package },
  { href: '/expenses', label: 'Biaya', icon: Receipt },
  { href: '/reports', label: 'Laporan', icon: FileText },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/laporan', label: 'Lap. Tabel', icon: BarChart2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodRange | null>(null);

  useEffect(() => {
    const sync = () => setPeriod(readStoredPeriod());
    sync();
    window.addEventListener(PERIOD_CHANGE_EVENT, sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === PERIOD_STORAGE_KEY) sync();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PERIOD_CHANGE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (!pathname.startsWith(href + '/')) return false;
    // Prefer the longest matching nav href so nested paths highlight correctly
    // and shorter prefixes (e.g. accidental overlaps) do not steal active state.
    const longerMatch = nav.some(
      (item) =>
        item.href !== href &&
        item.href.length > href.length &&
        (pathname === item.href || pathname.startsWith(item.href + '/')),
    );
    return !longerMatch;
  };

  const NavLinks = () => (
    <>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={hrefWithPeriod(href, period)}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive(href) ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="hidden md:flex w-56 min-h-screen bg-white border-r border-gray-100 flex-col shrink-0">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍜</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">UMKM Food</p>
              <p className="text-xs text-gray-500">Laporan Keuangan</p>
            </div>
          </div>
        </div>
        <NavLinks />
      </aside>

      {/* ===== MOBILE TOP BAR ===== */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center gap-2 justify-between px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">🍜</span>
          <p className="font-bold text-gray-900 text-sm truncate">UMKM Food</p>
        </div>
        <button onClick={() => setOpen(true)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-50">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ===== MOBILE DRAWER ===== */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-64 bg-white flex flex-col h-full shadow-xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍜</span>
                <p className="font-bold text-gray-900 text-sm">UMKM Food</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavLinks />
          </div>
        </div>
      )}
    </>
  );
}
