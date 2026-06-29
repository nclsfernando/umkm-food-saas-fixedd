'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatRupiah } from '@/lib/utils';

type ViewMode = 'daily' | 'monthly';

const MP = ['GrabFood', 'GoFood', 'ShopeeFood'];
const MP_COLOR: Record<string, string> = {
  GrabFood: 'text-green-700',
  GoFood: 'text-red-600',
  ShopeeFood: 'text-orange-500',
};

function fmt(v: number) { return v > 0 ? formatRupiah(v) : '-'; }

export default function LaporanPage() {
  const now = new Date();
  const [mode, setMode] = useState<ViewMode>('daily');
  const [from, setFrom] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`);
  const [to, setTo] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,'0')}`);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = mode === 'daily'
        ? await api.get('/dashboard/report/daily', { params: { from, to } })
        : await api.get('/dashboard/report/monthly', { params: { year } });
      setData(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [mode]);

  const totals = data.reduce((acc, row) => {
    for (const mp of [...MP, 'total']) {
      if (!acc[mp]) acc[mp] = { orders: 0, grossSales: 0, commission: 0, netSales: 0 };
      acc[mp].orders += row[mp]?.orders || 0;
      acc[mp].grossSales += row[mp]?.grossSales || 0;
      acc[mp].commission += row[mp]?.commission || 0;
      acc[mp].netSales += row[mp]?.netSales || 0;
    }
    return acc;
  }, {} as Record<string, any>);

  const dateLabel = (row: any) => {
    if (mode === 'daily') {
      const d = new Date(row.tanggal);
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const [y, m] = String(row.bulan).split('-');
    return new Date(Number(y), Number(m)-1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Laporan Marketplace</h1>
        <p className="text-gray-500 text-sm mt-0.5">Ringkasan penjualan per platform</p>
      </div>

      {/* Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setMode('daily')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'daily' ? 'bg-amber-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
          Per Tanggal
        </button>
        <button onClick={() => setMode('monthly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'monthly' ? 'bg-amber-500 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
          Per Bulan
        </button>
      </div>

      {/* Filter */}
      <div className="card">
        <div className="flex flex-wrap gap-2 items-end">
          {mode === 'daily' ? (
            <>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Dari</label>
                <input type="date" className="input text-sm" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Sampai</label>
                <input type="date" className="input text-sm" value={to} onChange={e => setTo(e.target.value)} />
              </div>
            </>
          ) : (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tahun</label>
              <select className="input text-sm" value={year} onChange={e => setYear(e.target.value)}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          <button onClick={load} className="btn-primary text-sm">Tampilkan</button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Memuat...</div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-xs md:text-sm min-w-[900px]">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold" rowSpan={2}>
                    {mode === 'daily' ? 'Tanggal' : 'Bulan'}
                  </th>
                  {MP.map(mp => (
                    <th key={mp} colSpan={3} className={`py-3 px-2 text-center font-semibold border-l border-gray-200 ${MP_COLOR[mp]}`}>
                      {mp}
                    </th>
                  ))}
                  <th colSpan={3} className="py-3 px-2 text-center font-semibold border-l border-gray-200 text-gray-700">
                    Total
                  </th>
                </tr>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {[...MP, 'Total'].map(mp => (
                    <>
                      <th key={`${mp}-gross`} className="py-2 px-2 text-right text-gray-400 font-normal border-l border-gray-100">Gross</th>
                      <th key={`${mp}-comm`} className="py-2 px-2 text-right text-gray-400 font-normal">Biaya</th>
                      <th key={`${mp}-net`} className="py-2 px-2 text-right text-gray-400 font-normal">Net</th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={13} className="text-center py-12 text-gray-400">Belum ada data</td></tr>
                ) : data.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-medium text-gray-700 whitespace-nowrap">{dateLabel(row)}</td>
                    {[...MP, 'total'].map(mp => (
                      <>
                        <td key={`${mp}-g`} className="py-2.5 px-2 text-right border-l border-gray-100 text-gray-600">{fmt(row[mp]?.grossSales || 0)}</td>
                        <td key={`${mp}-c`} className="py-2.5 px-2 text-right text-red-400">{row[mp]?.commission > 0 ? `-${formatRupiah(row[mp].commission)}` : '-'}</td>
                        <td key={`${mp}-n`} className="py-2.5 px-2 text-right font-semibold text-green-700">{fmt(row[mp]?.netSales || 0)}</td>
                      </>
                    ))}
                  </tr>
                ))}
              </tbody>
              {data.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-amber-50 font-semibold">
                    <td className="py-3 px-4 text-gray-700">Grand Total</td>
                    {[...MP, 'total'].map(mp => (
                      <>
                        <td key={`${mp}-g`} className="py-3 px-2 text-right border-l border-gray-200 text-gray-700">{fmt(totals[mp]?.grossSales || 0)}</td>
                        <td key={`${mp}-c`} className="py-3 px-2 text-right text-red-500">{totals[mp]?.commission > 0 ? `-${formatRupiah(totals[mp].commission)}` : '-'}</td>
                        <td key={`${mp}-n`} className="py-3 px-2 text-right text-green-700">{fmt(totals[mp]?.netSales || 0)}</td>
                      </>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
