'use client';
import { useEffect, useState } from 'react';
import { ordersApi } from '@/lib/api';
import { formatRupiah, formatDate, thisMonthRange } from '@/lib/utils';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

const MP_BADGE: Record<string, string> = {
  GOFOOD: 'badge-gofood',
  GRABFOOD: 'badge-grabfood',
  SHOPEEFOOD: 'badge-shopeefood',
};

export default function OrdersPage() {
  const { from: df, to: dt } = thisMonthRange();
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(df);
  const [to, setTo] = useState(dt);
  const [marketplace, setMarketplace] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = async () => {
    setLoading(true);
    try {
      const res = await ordersApi.list({ from, to, marketplace: marketplace || undefined, page, limit });
      setOrders(res.data.data);
      setTotal(res.data.total);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);
  const search = () => { setPage(1); load(); };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pesanan</h1>
        <p className="text-gray-500 text-sm mt-1">{total} transaksi ditemukan</p>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="date" className="input w-auto" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" className="input w-auto" value={to} onChange={e => setTo(e.target.value)} />
          <select className="input w-auto" value={marketplace} onChange={e => setMarketplace(e.target.value)}>
            <option value="">Semua Platform</option>
            <option value="GOFOOD">GoFood</option>
            <option value="GRABFOOD">GrabFood</option>
            <option value="SHOPEEFOOD">ShopeeFood</option>
          </select>
          <button onClick={search} className="btn-primary flex items-center gap-2">
            <Search className="w-4 h-4" /> Cari
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Memuat...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                  <th className="pb-3 pr-4">Tanggal</th>
                  <th className="pb-3 pr-4">Platform</th>
                  <th className="pb-3 pr-4">Order ID</th>
                  <th className="pb-3 pr-4 text-right">Gross Sales</th>
                  <th className="pb-3 pr-4 text-right">Diskon</th>
                  <th className="pb-3 pr-4 text-right">Komisi</th>
                  <th className="pb-3 text-right">Net Sales</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Belum ada data</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 pr-4 text-gray-600">{formatDate(o.orderDate)}</td>
                    <td className="py-3 pr-4"><span className={MP_BADGE[o.marketplace]}>{o.marketplace === 'GOFOOD' ? 'GoFood' : o.marketplace === 'GRABFOOD' ? 'GrabFood' : 'ShopeeFood'}</span></td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-500">{o.orderId}</td>
                    <td className="py-3 pr-4 text-right">{formatRupiah(Number(o.grossSales))}</td>
                    <td className="py-3 pr-4 text-right text-red-500">{o.discount > 0 ? `-${formatRupiah(Number(o.discount))}` : '-'}</td>
                    <td className="py-3 pr-4 text-right text-orange-500">{o.commission > 0 ? `-${formatRupiah(Number(o.commission))}` : '-'}</td>
                    <td className="py-3 text-right font-semibold text-green-700">{formatRupiah(Number(o.netSales))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Halaman {page} dari {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary p-2"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary p-2"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
