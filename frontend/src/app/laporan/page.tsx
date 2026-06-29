'use client';
import { useEffect, useState, useRef } from 'react';
import api from '@/lib/api';
import { formatRupiah } from '@/lib/utils';

type ViewMode = 'daily' | 'monthly';
const MP = ['GrabFood', 'GoFood', 'ShopeeFood'];
const MP_COLOR: Record<string, string> = {
  GrabFood: 'text-green-700', GoFood: 'text-red-600', ShopeeFood: 'text-orange-500',
};
function fmt(v: number) { return v > 0 ? formatRupiah(v) : '-'; }

export default function LaporanPage() {
  const now = new Date();
  const tableRef = useRef<HTMLTableElement>(null);
  const [mode, setMode] = useState<ViewMode>('daily');
  const [from, setFrom] = useState('2024-01-01');
  const [to, setTo] = useState(`${now.getFullYear()}-12-31`);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<'xlsx'|'pdf'|null>(null);

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

  const grandTotal: Record<string, number> = {};
  MP.forEach(mp => { grandTotal[mp] = data.reduce((a, r) => a + (r[mp]?.netSales || 0), 0); });
  grandTotal['total'] = data.reduce((a, r) => a + (r.total?.netSales || 0), 0);

  const dateLabel = (row: any) => {
    if (mode === 'daily') {
      return new Date(row.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const [y, m] = String(row.bulan).split('-');
    return new Date(Number(y), Number(m)-1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  // Build flat rows with monthly subtotals
  const buildRows = () => {
    const rows: { type: 'data'|'subtotal'; label: string; values: Record<string,number> }[] = [];
    let currentMonth = '';
    let monthTotals: Record<string,number> = {};
    let monthLabel = '';

    const flushMonth = () => {
      if (!monthLabel) return;
      rows.push({ type: 'subtotal', label: `Total ${monthLabel}`, values: { ...monthTotals } });
      monthTotals = {};
    };

    data.forEach(row => {
      const d = new Date(row.tanggal || row.bulan);
      const month = `${d.getFullYear()}-${d.getMonth()}`;
      const mLabel = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

      if (mode === 'daily' && currentMonth && currentMonth !== month) flushMonth();
      currentMonth = month;
      monthLabel = mLabel;

      const vals: Record<string,number> = {};
      MP.forEach(mp => {
        vals[mp] = row[mp]?.netSales || 0;
        monthTotals[mp] = (monthTotals[mp] || 0) + (row[mp]?.netSales || 0);
      });
      vals['total'] = row.total?.netSales || 0;
      monthTotals['total'] = (monthTotals['total'] || 0) + (row.total?.netSales || 0);

      rows.push({ type: 'data', label: dateLabel(row), values: vals });
    });

    if (mode === 'daily') flushMonth();
    return rows;
  };

  const downloadXlsx = async () => {
    setDownloading('xlsx');
    try {
      const XLSX = await import('xlsx');
      const rows = buildRows();
      const wsData = [
        [`Laporan Marketplace - ${mode === 'daily' ? `${from} s/d ${to}` : `Tahun ${year}`}`],
        [],
        [mode === 'daily' ? 'Tanggal' : 'Bulan', 'GrabFood', 'GoFood', 'ShopeeFood', 'Total'],
        ...rows.map(r => [r.label, r.values['GrabFood']||0, r.values['GoFood']||0, r.values['ShopeeFood']||0, r.values['total']||0]),
        [],
        ['GRAND TOTAL', grandTotal['GrabFood']||0, grandTotal['GoFood']||0, grandTotal['ShopeeFood']||0, grandTotal['total']||0],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
      XLSX.writeFile(wb, `Laporan_Marketplace_${mode === 'daily' ? from+'_'+to : year}.xlsx`);
    } finally { setDownloading(null); }
  };

  const downloadPdf = async () => {
    setDownloading('pdf');
    try {
      const rows = buildRows();
      const title = `Laporan Marketplace — ${mode === 'daily' ? `${from} s/d ${to}` : `Tahun ${year}`}`;
      const html = `
        <html><head><meta charset="utf-8"><style>
          body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
          h2 { font-size: 14px; margin-bottom: 12px; color: #1f2937; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f59e0b; color: white; padding: 6px 8px; text-align: right; font-size: 10px; }
          th:first-child { text-align: left; }
          td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; text-align: right; font-size: 10px; }
          td:first-child { text-align: left; }
          tr.subtotal td { background: #fef3c7; font-weight: bold; color: #b45309; }
          tr.grand td { background: #f59e0b; color: white; font-weight: bold; }
          tr:hover td { background: #fffbeb; }
        </style></head><body>
        <h2>${title}</h2>
        <table>
          <thead><tr>
            <th>${mode === 'daily' ? 'Tanggal' : 'Bulan'}</th>
            <th style="color:#86efac">GrabFood</th>
            <th style="color:#fca5a5">GoFood</th>
            <th style="color:#fdba74">ShopeeFood</th>
            <th>Total</th>
          </tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr class="${r.type === 'subtotal' ? 'subtotal' : ''}">
                <td>${r.label}</td>
                <td>${r.values['GrabFood'] > 0 ? formatRupiah(r.values['GrabFood']) : '-'}</td>
                <td>${r.values['GoFood'] > 0 ? formatRupiah(r.values['GoFood']) : '-'}</td>
                <td>${r.values['ShopeeFood'] > 0 ? formatRupiah(r.values['ShopeeFood']) : '-'}</td>
                <td>${r.values['total'] > 0 ? formatRupiah(r.values['total']) : '-'}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr class="grand">
              <td>GRAND TOTAL</td>
              <td>${formatRupiah(grandTotal['GrabFood']||0)}</td>
              <td>${formatRupiah(grandTotal['GoFood']||0)}</td>
              <td>${formatRupiah(grandTotal['ShopeeFood']||0)}</td>
              <td>${formatRupiah(grandTotal['total']||0)}</td>
            </tr>
          </tfoot>
        </table>
        <p style="margin-top:16px;color:#9ca3af;font-size:9px">Digenerate oleh UMKM Food · ${new Date().toLocaleString('id-ID')}</p>
        </body></html>`;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); }, 500);
      }
    } finally { setDownloading(null); }
  };

  const flatRows = buildRows();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Laporan Marketplace</h1>
          <p className="text-gray-500 text-sm mt-0.5">Net cair per merchant</p>
        </div>
        {/* Download buttons */}
        {data.length > 0 && (
          <div className="flex gap-2">
            <button onClick={downloadXlsx} disabled={!!downloading}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
              {downloading === 'xlsx' ? '⏳' : '📊'} Excel
            </button>
            <button onClick={downloadPdf} disabled={!!downloading}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
              {downloading === 'pdf' ? '⏳' : '📄'} PDF
            </button>
          </div>
        )}
      </div>

      {/* Toggle + Filter */}
      <div className="card space-y-3">
        <div className="flex gap-2">
          <button onClick={() => setMode('daily')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'daily' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Per Tanggal
          </button>
          <button onClick={() => setMode('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'monthly' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Per Bulan
          </button>
        </div>
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
          <div className="text-center py-12 text-gray-400">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500 mx-auto mb-2" />
            Memuat laporan...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table ref={tableRef} className="w-full text-xs md:text-sm min-w-[500px]">
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
                {flatRows.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">Belum ada data</td></tr>
                ) : flatRows.map((row, i) => (
                  row.type === 'subtotal' ? (
                    <tr key={i} className="border-b-2 border-amber-200 bg-amber-50 font-semibold text-xs">
                      <td className="py-2 px-4 text-amber-800">{row.label}</td>
                      {MP.map(mp => (
                        <td key={mp} className={`py-2 px-3 text-right ${row.values[mp] > 0 ? MP_COLOR[mp] : 'text-gray-300'}`}>
                          {fmt(row.values[mp])}
                        </td>
                      ))}
                      <td className="py-2 px-4 text-right font-bold text-amber-700">{fmt(row.values['total'])}</td>
                    </tr>
                  ) : (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-medium text-gray-700 whitespace-nowrap">{row.label}</td>
                      {MP.map(mp => (
                        <td key={mp} className={`py-2.5 px-3 text-right ${row.values[mp] > 0 ? MP_COLOR[mp] : 'text-gray-300'}`}>
                          {fmt(row.values[mp])}
                        </td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-bold text-gray-900 bg-amber-50/50">
                        {fmt(row.values['total'])}
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
              {flatRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-amber-500 text-white font-bold">
                    <td className="py-3 px-4">Grand Total</td>
                    {MP.map(mp => (
                      <td key={mp} className="py-3 px-3 text-right">{fmt(grandTotal[mp])}</td>
                    ))}
                    <td className="py-3 px-4 text-right bg-amber-600">{fmt(grandTotal['total'])}</td>
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
