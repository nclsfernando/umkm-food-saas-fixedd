'use client';
import { useState } from 'react';
import { reportsApi } from '@/lib/api';
import { formatRupiah, thisMonthRange } from '@/lib/utils';
import { FileText, TrendingUp, TrendingDown } from 'lucide-react';

export default function ReportsPage() {
  const { from: df, to: dt } = thisMonthRange();
  const [from, setFrom] = useState(df);
  const [to, setTo] = useState(dt);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await reportsApi.profitLoss(from, to);
    setReport(res.data);
    setLoading(false);
  };

  const Row = ({ label, value, highlight, negative }: { label: string; value: number; highlight?: boolean; negative?: boolean }) => (
    <div className={`flex justify-between py-2.5 ${highlight ? 'border-t border-gray-200 mt-1 pt-3' : 'border-b border-gray-50'}`}>
      <span className={`text-sm ${highlight ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-medium ${negative ? 'text-red-600' : highlight ? (value >= 0 ? 'text-green-700 font-bold text-base' : 'text-red-700 font-bold text-base') : 'text-gray-900'}`}>
        {negative ? `(${formatRupiah(value)})` : formatRupiah(value)}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Laporan Keuangan</h1>
        <p className="text-gray-500 text-sm mt-1">Laba rugi bisnis kamu</p>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Dari Tanggal</label>
            <input type="date" className="input w-auto" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Sampai Tanggal</label>
            <input type="date" className="input w-auto" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button onClick={load} disabled={loading} className="btn-primary flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {loading ? 'Memuat...' : 'Generate Laporan'}
          </button>
        </div>
      </div>

      {report && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" /> Laporan Laba Rugi
            </h2>
            <p className="text-xs text-gray-400 mb-4">{report.period.from} s/d {report.period.to} · {report.orders} pesanan</p>

            <div className="space-y-0">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Pendapatan</p>
              <Row label="Gross Sales" value={report.revenue.grossSales} />
              <Row label="Diskon Marketplace" value={report.revenue.discount} negative />
              <Row label="Komisi Marketplace" value={report.revenue.commission} negative />
              <Row label="Net Sales" value={report.revenue.netSales} highlight />

              <p className="text-xs font-semibold text-gray-400 uppercase mb-2 mt-4">Harga Pokok Penjualan</p>
              <Row label="HPP (Harga Modal)" value={report.cogs.hpp} negative />
              <Row label="Laba Kotor" value={report.grossProfit} highlight />

              <p className="text-xs font-semibold text-gray-400 uppercase mb-2 mt-4">Biaya Operasional</p>
              {Object.entries(report.operatingExpenses.byCategory || {}).map(([cat, amt]) => (
                <Row key={cat} label={cat} value={amt as number} negative />
              ))}
              <Row label="Total Biaya Ops" value={report.operatingExpenses.total} negative />

              <Row label="🎯 LABA BERSIH" value={report.netProfit} highlight />
            </div>
          </div>

          <div className="card">
            <h2 className="font-bold text-gray-900 mb-4">Ringkasan Cepat</h2>
            <div className="space-y-4">
              {[
                { label: 'Net Sales', value: report.revenue.netSales, color: 'green' },
                { label: 'Total HPP', value: report.cogs.hpp, color: 'red' },
                { label: 'Total Biaya Ops', value: report.operatingExpenses.total, color: 'orange' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700">{label}</span>
                  <span className={`font-bold text-${color}-600`}>{formatRupiah(value)}</span>
                </div>
              ))}
              <div className={`flex items-center justify-between p-4 rounded-xl ${report.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center gap-2">
                  {report.netProfit >= 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                  <span className="font-bold text-gray-900">Laba Bersih</span>
                </div>
                <span className={`text-xl font-bold ${report.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatRupiah(report.netProfit)}
                </span>
              </div>
              <div className="text-xs text-gray-400 text-center">
                Margin: {report.revenue.netSales > 0 ? ((report.netProfit / report.revenue.netSales) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="card text-center py-16">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400">Pilih rentang tanggal dan klik "Generate Laporan"</p>
        </div>
      )}
    </div>
  );
}
