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
  const [from, setFrom] = useState('2024-01-01');
  const [to, setTo] = useState(`${now.getFullYear()}-12-31`);
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

  // Grand total per merchant dan keseluruhan
  const grandTotal: Record<string, number> = {};
  MP.forEach(mp => {
    grandTotal[mp] = data.reduce((a, row) => a + (row[mp]?.netSales || 0), 0);
  });
  grandTotal['total'] = data.reduce((a, row) => a + (row.total?.netSales || 0), 0);

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
        <p className="text-gray-500 text-sm mt-0.5">Net cair per merchant</p>
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
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Memuat...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm min-w-[500px]">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold">
                    {mode === 'daily' ? 'Tanggal' : 'Bulan'}
                  </th>
                  {MP.map(mp => (
                    <th key={mp} className={`py-3 px-3 text-right font-semibold ${MP_COLOR[mp]}`}>{mp}</th>
                  ))}
                  <th className="py-3 px-4 text-right font-bold text-gray-900 bg-amber-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">Belum ada data</td></tr>
                ) : (() => {
                  const rows: any[] = [];
                  let currentMonth = '';
                  let monthTotals: Record<string, number> = { GrabFood: 0, GoFood: 0, ShopeeFood: 0, total: 0 };
                  let monthLabel = '';

                  const flushMonth = () => {
                    if (!monthLabel) return;
                    rows.push(
                      <tr key={`month-${monthLabel}`} className="border-b-2 border-amber-200 bg-amber-50 font-semibold text-xs">
                        <td className="py-2 px-4 text-amber-800">Total {monthLabel}</td>
                        {MP.map(mp => (
                          <td key={mp} className={`py-2 px-3 text-right ${monthTotals[mp] > 0 ? MP_COLOR[mp] : 'text-gray-300'}`}>
                            {fmt(monthTotals[mp])}
                          </td>
                        ))}
                        <td className="py-2 px-4 text-right font-bold text-amber-700">{fmt(monthTotals['total'])}</td>
                      </tr>
                    );
                    monthTotals = { GrabFood: 0, GoFood: 0, ShopeeFood: 0, total: 0 };
                  };

                  data.forEach((row, i) => {
                    const d = new Date(row.tanggal);
                    const month = `${d.getFullYear()}-${d.getMonth()}`;
                    const mLabel = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

                    if (mode === 'daily' && currentMonth && currentMonth !== month) {
                      flushMonth();
                    }
                    currentMonth = month;
                    monthLabel = mLabel;

                    MP.forEach(mp => { monthTotals[mp] = (monthTotals[mp] || 0) + (row[mp]?.netSales || 0); });
                    monthTotals['total'] = (monthTotals['total'] || 0) + (row.total?.netSales || 0);

                    rows.push(
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-4 font-medium text-gray-700 whitespace-nowrap">{dateLabel(row)}</td>
                        {MP.map(mp => (
                          <td key={mp} className={`py-2.5 px-3 text-right ${row[mp]?.netSales > 0 ? MP_COLOR[mp] : 'text-gray-300'}`}>
                            {fmt(row[mp]?.netSales || 0)}
                          </td>
                        ))}
                        <td className="py-2.5 px-4 text-right font-bold text-gray-900 bg-amber-50/50">
                          {fmt(row.total?.netSales || 0)}
                        </td>
                      </tr>
                    );
                  });

                  if (mode === 'daily') flushMonth();
                  return rows;
                })()}
              </tbody>
              {data.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-amber-50 font-bold">
                    <td className="py-3 px-4 text-gray-900">
                      Total {mode === 'daily' ? 'Keseluruhan' : 'Tahunan'}
                    </td>
                    {MP.map(mp => (
                      <td key={mp} className={`py-3 px-3 text-right ${MP_COLOR[mp]}`}>
                        {fmt(grandTotal[mp])}
                      </td>
                    ))}
                    <td className="py-3 px-4 text-right text-amber-700 bg-amber-100 text-base">
                      {fmt(grandTotal['total'])}
                    </td>
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
