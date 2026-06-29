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

const MP_LABEL: Record<string, string> = {
  GOFOOD: 'GoFood',
  GRABFOOD: 'GrabFood',
  SHOPEEFOOD: 'ShopeeFood',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
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

  const parseItemMeta = (items: any[]) => {
    if (!items || items.length === 0) return { jenis: '-', metode: '-', idPesanan: '-', biayaJasa: 0, biayaSukses: 0, mdr: 0 };
    const name = items[0]?.productName || '';
    try {
      const meta = JSON.parse(name);
      return {
        jenis: meta.jenis || '-',
        metode: meta.metode || '-',
        idPesanan: meta.idPesanan || '-',
        biayaJasa: meta.biayaJasa || 0,
        biayaSukses: meta.biayaSukses || 0,
        mdr: meta.mdr || 0,
      };
    } catch {
      // Format lama: "GrabFood - Nontunai - GF-495"
      const parts = name.split(' - ');
      return { jenis: parts[0] || '-', metode: parts[1] || '-', idPesanan: parts[2] || '-', biayaJasa: 0, biayaSukses: 0, mdr: 0 };
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Pesanan</h1>
        <p className="text-gray-500 text-sm mt-1">{total} transaksi ditemukan</p>
      </div>

      <div className="card">
        {/* Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="date" className="input w-auto text-sm" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" className="input w-auto text-sm" value={to} onChange={e => setTo(e.target.value)} />
          <select className="input w-auto text-sm" value={marketplace} onChange={e => setMarketplace(e.target.value)}>
            <option value="">Semua Platform</option>
            <option value="GRABFOOD">GrabFood</option>
            <option value="GOFOOD">GoFood</option>
            <option value="SHOPEEFOOD">ShopeeFood</option>
          </select>
          <button onClick={search} className="btn-primary flex items-center gap-2 text-sm">
            <Search className="w-4 h-4" /> Cari
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Memuat...</div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-xs md:text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="pb-3 pr-3 pl-4 md:pl-0">Tanggal</th>
                  <th className="pb-3 pr-3">Platform</th>
                  <th className="pb-3 pr-3">Jenis</th>
                  <th className="pb-3 pr-3">Metode Bayar</th>
                  <th className="pb-3 pr-3">ID Pesanan</th>
                  <th className="pb-3 pr-3 text-right">Gross Sales</th>
                  <th className="pb-3 pr-3 text-right">Biaya Jasa</th>
                  <th className="pb-3 pr-3 text-right">Biaya Sukses</th>
                  <th className="pb-3 pr-3 text-right">MDR</th>
                  <th className="pb-3 text-right">Net Cair</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400">Belum ada data</td></tr>
                ) : orders.map(o => {
                  const { jenis, metode, idPesanan, biayaJasa, biayaSukses, mdr } = parseItemMeta(o.items);
                  return (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 pr-3 pl-4 md:pl-0 text-gray-600 whitespace-nowrap">{formatDate(o.orderDate)}</td>
                      <td className="py-2.5 pr-3">
                        <span className={MP_BADGE[o.marketplace] || 'badge-grabfood'}>
                          {MP_LABEL[o.marketplace] || o.marketplace}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-700 whitespace-nowrap">{jenis}</td>
                      <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap">{metode}</td>
                      <td className="py-2.5 pr-3 font-mono text-gray-400 whitespace-nowrap">{idPesanan !== '-' ? idPesanan : '-'}</td>
                      <td className="py-2.5 pr-3 text-right font-medium">{formatRupiah(Number(o.grossSales))}</td>
                      <td className="py-2.5 pr-3 text-right text-red-500">{biayaJasa > 0 ? `-${formatRupiah(biayaJasa)}` : '-'}</td>
                      <td className="py-2.5 pr-3 text-right text-orange-500">{biayaSukses > 0 ? `-${formatRupiah(biayaSukses)}` : '-'}</td>
                      <td className="py-2.5 pr-3 text-right text-orange-400">{mdr > 0 ? `-${formatRupiah(mdr)}` : '-'}</td>
                      <td className="py-2.5 text-right font-semibold text-green-700">{formatRupiah(Number(o.netSales))}</td>
                    </tr>
                  );
                })}
              </tbody>
              {orders.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td colSpan={5} className="py-3 pl-4 md:pl-0 text-sm text-gray-600">Total ({orders.length} transaksi)</td>
                    <td className="py-3 pr-3 text-right text-sm">{formatRupiah(orders.reduce((a, o) => a + Number(o.grossSales), 0))}</td>
                    <td className="py-3 pr-3 text-right text-sm text-red-500">-{formatRupiah(orders.reduce((a, o) => a + Number(o.commission), 0))}</td>
                    <td className="py-3 pr-3 text-right text-sm">-</td>
                    <td className="py-3 pr-3 text-right text-sm">-</td>
                    <td className="py-3 text-right text-sm text-green-700">{formatRupiah(orders.reduce((a, o) => a + Number(o.netSales), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Hal. {page} / {totalPages}</p>
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
