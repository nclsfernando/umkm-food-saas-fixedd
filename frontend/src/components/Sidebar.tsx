'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Package, Receipt, FileText, LogOut } from 'lucide-react';
import Cookies from 'js-cookie';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Pesanan', icon: ShoppingBag },
  { href: '/products', label: 'Produk', icon: Package },
  { href: '/expenses', label: 'Biaya', icon: Receipt },
  { href: '/reports', label: 'Laporan', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    Cookies.remove('token');
    router.push('/login');
  };

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍜</span>
          <div>
            <p className="font-bold text-gray-900 text-sm">UMKM Food</p>
            <p className="text-xs text-gray-500">Laporan Keuangan</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
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
  );
}
