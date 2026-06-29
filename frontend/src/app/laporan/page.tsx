'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { formatRupiah } from '@/lib/utils';

type ViewMode = 'daily' | 'monthly';

const MP = ['GrabFood', 'GoFood', 'ShopeeFood'];
const MP_COLOR: Record<string, string> = {
  GrabFood: 'text-green-700 font-medium',
  GoFood: 'text-red-600 font-medium',
  ShopeeFood: 'text-orange-500 font-medium',
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

  const grandTotal = data.reduce((acc, row) => acc + (row.total?.netSales || 0), 0);
  const grandTotalByMp: Record<string, number> = {};
  MP.forEach(mp => {
    grandTotalByMp[mp] = data.reduce((acc, row) => acc + (row[mp]?.netSales || 0), 0);
  });

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
        <p className="text-gray-500 text-sm mt-0.5">Net cair per merchant per {mode === 'daily' ? 'tanggal' : 'bulan'}</p>
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
          <div className="text-center py-12 text-gray-400 p-6">Memuat...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold w-32">
                    {mode === 'daily' ? 'Tanggal' : 'Bulan'}
                  </th>
                  <th className="py-3 px-4 text-left text-gray-600 font-semibold">Merchant</th>
                  <th className="py-3 px-4 text-right text-gray-600 font-semibold">Net Cair</th>
                  <th className="py-3 px-4 text-right text-gray-600 font-semibold bg-amber-50">Total / {mode === 'daily' ? 'Tgl' : 'Bulan'}</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-12 text-gray-400">Belum ada data</td></tr>
                ) : data.map((row, i) => (
                  MP.map((mp, j) => (
                    <tr key={`${i}-${j}`} className={`border-b border-gray-50 hover:bg-gray-50 ${j === 0 && i > 0 ? 'border-t border-gray-200' : ''}`}>
                      {/* TGL hanya di baris pertama tiap grup */}
                      {j === 0 ? (
                        <td rowSpan={3} className="py-2.5 px-4 align-top font-medium text-gray-700 whitespace-nowrap border-r border-gray-100 bg-gray-50/50">
                          {dateLabel(row)}
                        </td>
                      ) : null}
                      <td className={`py-2.5 px-4 ${MP_COLOR[mp]}`}>{mp}</td>
                      <td className="py-2.5 px-4 text-right text-gray-700">
                        {fmt(row[mp]?.netSales || 0)}
                      </td>
                      {/* Total hanya di baris pertama tiap grup */}
                      {j === 0 ? (
                        <td rowSpan={3} className="py-2.5 px-4 text-right font-bold text-gray-900 align-middle bg-amber-50/50 border-l border-amber-100">
                          {fmt(row.total?.netSales || 0)}
                        </td>
                      ) : null}
                    </tr>
                  ))
                ))}
              </tbody>
              {data.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-amber-50">
                    <td className="py-3 px-4 font-bold text-gray-900">TOTAL</td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {MP.map(mp => (
                          <div key={mp} className={`text-xs ${MP_COLOR[mp]}`}>
                            {mp}: {fmt(grandTotalByMp[mp])}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">
                      {MP.map(mp => (
                        <div key={mp} className="text-xs text-gray-600">{fmt(grandTotalByMp[mp])}</div>
                      ))}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-lg text-amber-600 bg-amber-100 border-l border-amber-200">
                      {fmt(grandTotal)}
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
