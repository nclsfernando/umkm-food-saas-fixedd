'use client';
import { useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/api';
import { formatRupiah, thisMonthRange } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, ShoppingBag, Wallet, Clock } from 'lucide-react';

const COLORS = ['#00AA5B', '#00B14F', '#EE4D2D'];

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  const [chart, setChart] = useState<any[]>([]);
  const [marketplace, setMarketplace] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 29);
    const from = fromDate.toISOString().split('T')[0];

    Promise.all([
      dashboardApi.summary(),
      dashboardApi.dailyChart(now.getFullYear(), now.getMonth() + 1),
      dashboardApi.marketplace(from, to),
    ]).then(([s, c, m]) => {
      setSummary(s.data);
      setChart(c.data);
      setMarketplace(m.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>;

  const stats = [
    { label: 'Net Sales 30 Hari', value: formatRupiah(summary?.month?.netSales ?? 0), icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Order 30 Hari', value: summary?.month?.orders ?? 0, icon: ShoppingBag, color: 'text-blue-600 bg-blue-50' },
    { label: 'Laba Bersih 30 Hari', value: formatRupiah(summary?.month?.netProfit ?? 0), icon: Wallet, color: 'text-amber-600 bg-amber-50' },
    { label: 'Settlement Pending', value: formatRupiah(Number(summary?.pendingSettlement ?? 0)), icon: Clock, color: 'text-red-600 bg-red-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Ringkasan performa bisnis kamu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">Grafik Net Sales Harian</h2>
          {chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(8)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatRupiah(v)} />
                <Bar dataKey="net_sales" fill="#f59e0b" radius={[4,4,0,0]} name="Net Sales" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-16">Belum ada data bulan ini</p>}
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Marketplace Breakdown</h2>
          {marketplace.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={marketplace} dataKey="netSales" nameKey="marketplace" cx="50%" cy="45%" outerRadius={80}>
                  {marketplace.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend formatter={v => v === 'GOFOOD' ? 'GoFood' : v === 'GRABFOOD' ? 'GrabFood' : 'ShopeeFood'} />
                <Tooltip formatter={(v: number) => formatRupiah(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-400 text-sm text-center py-16">Belum ada data</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Gross Sales Hari Ini', value: formatRupiah(summary?.today?.grossSales ?? 0) },
          { label: 'Order Minggu Ini', value: summary?.week?.orders ?? 0 },
          { label: 'Net Sales Minggu Ini', value: formatRupiah(summary?.week?.netSales ?? 0) },
        ].map(({ label, value }) => (
          <div key={label} className="card text-center">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
