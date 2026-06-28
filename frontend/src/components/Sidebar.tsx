'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Package, Receipt, FileText, LogOut, Upload, Menu, X } from 'lucide-react';
import Cookies from 'js-cookie';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Pesanan', icon: ShoppingBag },
  { href: '/products', label: 'Produk', icon: Package },
  { href: '/expenses', label: 'Biaya', icon: Receipt },
  { href: '/reports', label: 'Laporan', icon: FileText },
  { href: '/import', label: 'Import Mutasi', icon: Upload },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const logout = () => {
    Cookies.remove('token');
    router.push('/login');
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍜</span>
          <div>
            <p className="font-bold text-gray-900 text-sm">UMKM Food</p>
            <p className="text-xs text-gray-500">Laporan Keuangan</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-50"
          aria-label="Buka menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar / drawer */}
      <aside
        className={cn(
          'w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col',
          'fixed inset-y-0 left-0 z-50 transform transition-transform duration-200',
          'md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍜</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">UMKM Food</p>
              <p className="text-xs text-gray-500">Laporan Keuangan</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden p-1 text-gray-400 hover:text-gray-600"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-amber-50 text-amber-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full">
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}
