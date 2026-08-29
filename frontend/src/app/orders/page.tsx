'use client';
import { useEffect, useState } from 'react';
import { formatApiError, ordersApi } from '@/lib/api';
import { formatRupiah, formatDate } from '@/lib/utils';
import { usePeriod } from '@/hooks/usePeriod';
import { downloadAoaAsXlsx, printHtmlAsPdf } from '@/lib/client-export';
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

const EXPORT_HEADERS = [
  'Tanggal',
  'Platform',
  'Jenis',
  'Metode Bayar',
  'ID Pesanan',
  'Gross Sales',
  'Biaya Jasa',
  'Biaya Sukses',
  'MDR',
  'Net Cair',
  'Tgl Transfer',
  'ID Pencairan',
];

export default function OrdersPage() {
  const { from: periodFrom, to: periodTo, ready, setPeriod, label } = usePeriod();
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [marketplace, setMarketplace] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<'xlsx' | 'pdf' | null>(null);
  const limit = 200;

  useEffect(() => {
    if (!ready) return;
    setFrom(periodFrom);
    setTo(periodTo);
  }, [ready, periodFrom, periodTo]);

  const load = async (f = from, t = to, p = page) => {
    setLoading(true);
    setError('');
    try {
      const res = await ordersApi.list({
        from: f || undefined,
        to: t || undefined,
        marketplace: marketplace || undefined,
        page: p,
        limit,
      });
      setOrders(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      setOrders([]);
      setTotal(0);
      setError(formatApiError(err, 'Gagal memuat pesanan'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    load(periodFrom, periodTo, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, page, periodFrom, periodTo]);

  const search = () => {
    setPage(1);
    setPeriod(from, to);
    // Reload immediately so marketplace filter applies even when dates unchanged
    void load(from, to, 1);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  const parseItemMeta = (items: any[]) => {
    if (!items || items.length === 0) {
      return {
        jenis: '-',
        metode: '-',
        idPesanan: '-',
        biayaJasa: 0,
        biayaSukses: 0,
        mdr: 0,
        tanggalTransfer: '-',
        idPencairan: '-',
      };
    }
    const name = items[0]?.productName || '';
    try {
      const meta = JSON.parse(name);
      return {
        jenis: meta.jenis || '-',
        metode: meta.metode || '-',
        idPesanan: meta.idPesanan || '-',
        biayaJasa: Number(meta.biayaJasa) || 0,
        biayaSukses: Number(meta.biayaSukses) || 0,
        mdr: Number(meta.mdr) || 0,
        tanggalTransfer: meta.tanggalTransfer || '-',
        idPencairan: meta.idPencairan || '-',
      };
    } catch {
      const parts = name.split(' - ');
      return {
        jenis: parts[0] || '-',
        metode: parts[1] || '-',
        idPesanan: parts[2] || '-',
        biayaJasa: 0,
        biayaSukses: 0,
        mdr: 0,
        tanggalTransfer: '-',
        idPencairan: '-',
      };
    }
  };

  const calcNetCair = (grossSales: number, biayaJasa: number, biayaSukses: number, mdr: number) =>
    grossSales - biayaJasa - biayaSukses - mdr;

  const mapOrderRow = (o: any) => {
    const meta = parseItemMeta(o.items);
    const netCair = calcNetCair(Number(o.grossSales), meta.biayaJasa, meta.biayaSukses, meta.mdr);
    return {
      tanggal: formatDate(o.orderDate),
      platform: MP_LABEL[o.marketplace] || o.marketplace,
      jenis: meta.jenis,
      metode: meta.metode,
      idPesanan: meta.idPesanan,
      grossSales: Number(o.grossSales) || 0,
      biayaJasa: meta.biayaJasa,
      biayaSukses: meta.biayaSukses,
      mdr: meta.mdr,
      netCair,
      tanggalTransfer: meta.tanggalTransfer,
      idPencairan: meta.idPencairan,
    };
  };

  /** Fetch all pages matching current filters for export. */
  const fetchAllForExport = async () => {
    const pageSize = 500;
    const first = await ordersApi.list({
      from: from || undefined,
      to: to || undefined,
      marketplace: marketplace || undefined,
      page: 1,
      limit: pageSize,
    });
    const all = [...(first.data.data || [])];
    const totalCount = first.data.total || all.length;
    const pages = Math.ceil(totalCount / pageSize);
    for (let p = 2; p <= pages; p++) {
      const res = await ordersApi.list({
        from: from || undefined,
        to: to || undefined,
        marketplace: marketplace || undefined,
        page: p,
        limit: pageSize,
      });
      all.push(...(res.data.data || []));
    }
    return all.map(mapOrderRow);
  };

  const periodTitle = from && to ? label : 'Semua periode';
  const mpTitle = marketplace ? MP_LABEL[marketplace] || marketplace : 'Semua platform';

  const downloadXlsx = async () => {
    setDownloading('xlsx');
    try {
      const rows = await fetchAllForExport();
      const totals = rows.reduce(
        (a, r) => ({
          gross: a.gross + r.grossSales,
          jasa: a.jasa + r.biayaJasa,
          sukses: a.sukses + r.biayaSukses,
          mdr: a.mdr + r.mdr,
          net: a.net + r.netCair,
        }),
        { gross: 0, jasa: 0, sukses: 0, mdr: 0, net: 0 },
      );
      await downloadAoaAsXlsx(
        [
          [`Pesanan — ${periodTitle} · ${mpTitle}`],
          [],
          EXPORT_HEADERS,
          ...rows.map((r) => [
            r.tanggal,
            r.platform,
            r.jenis,
            r.metode,
            r.idPesanan,
            r.grossSales,
            r.biayaJasa,
            r.biayaSukses,
            r.mdr,
            r.netCair,
            r.tanggalTransfer,
            r.idPencairan,
          ]),
          [],
          [
            `TOTAL (${rows.length} transaksi)`,
            '',
            '',
            '',
            '',
            totals.gross,
            totals.jasa,
            totals.sukses,
            totals.mdr,
            totals.net,
            '',
            '',
          ],
        ],
        `Pesanan_${from || 'all'}_${to || 'all'}${marketplace ? '_' + marketplace : ''}`,
        {
          sheetName: 'Pesanan',
          cols: [
            { wch: 14 },
            { wch: 12 },
            { wch: 14 },
            { wch: 14 },
            { wch: 22 },
            { wch: 14 },
            { wch: 12 },
            { wch: 12 },
            { wch: 10 },
            { wch: 14 },
            { wch: 14 },
            { wch: 18 },
          ],
        },
      );
    } catch (err) {
      setError(formatApiError(err, 'Gagal unduh Excel'));
    } finally {
      setDownloading(null);
    }
  };

  const downloadPdf = async () => {
    setDownloading('pdf');
    try {
      const rows = await fetchAllForExport();
      const totals = rows.reduce(
        (a, r) => ({
          gross: a.gross + r.grossSales,
          jasa: a.jasa + r.biayaJasa,
          sukses: a.sukses + r.biayaSukses,
          mdr: a.mdr + r.mdr,
          net: a.net + r.netCair,
        }),
        { gross: 0, jasa: 0, sukses: 0, mdr: 0, net: 0 },
      );
      const html = `
        <html><head><meta charset="utf-8"><style>
          @page { size: landscape; margin: 12mm; }
          body { font-family: Arial, sans-serif; font-size: 9px; padding: 12px; color: #111; }
          h2 { font-size: 13px; margin: 0 0 4px; }
          .sub { color: #6b7280; margin-bottom: 12px; font-size: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f59e0b; color: white; padding: 5px 6px; text-align: left; font-size: 8px; }
          th.num, td.num { text-align: right; }
          td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; font-size: 8px; }
          tr.grand td { background: #f59e0b; color: white; font-weight: bold; }
          .foot { margin-top: 12px; color: #9ca3af; font-size: 8px; }
        </style></head><body>
        <h2>Pesanan</h2>
        <p class="sub">${periodTitle} · ${mpTitle} · ${rows.length} transaksi</p>
        <table>
          <thead><tr>
            ${EXPORT_HEADERS.map((h, i) => `<th class="${i >= 5 && i <= 9 ? 'num' : ''}">${h}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${rows
              .map(
                (r) => `
              <tr>
                <td>${r.tanggal}</td>
                <td>${r.platform}</td>
                <td>${r.jenis}</td>
                <td>${r.metode}</td>
                <td>${r.idPesanan}</td>
                <td class="num">${formatRupiah(r.grossSales)}</td>
                <td class="num">${r.biayaJasa > 0 ? '-' + formatRupiah(r.biayaJasa) : '-'}</td>
                <td class="num">${r.biayaSukses > 0 ? '-' + formatRupiah(r.biayaSukses) : '-'}</td>
                <td class="num">${r.mdr > 0 ? '-' + formatRupiah(r.mdr) : '-'}</td>
                <td class="num">${formatRupiah(r.netCair)}</td>
                <td>${r.tanggalTransfer}</td>
                <td>${r.idPencairan}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr class="grand">
              <td colspan="5">TOTAL (${rows.length})</td>
              <td class="num">${formatRupiah(totals.gross)}</td>
              <td class="num">-${formatRupiah(totals.jasa)}</td>
              <td class="num">-${formatRupiah(totals.sukses)}</td>
              <td class="num">-${formatRupiah(totals.mdr)}</td>
              <td class="num">${formatRupiah(totals.net)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
        <p class="foot">Digenerate oleh UMKM Food · ${new Date().toLocaleString('id-ID')}</p>
        </body></html>`;
      printHtmlAsPdf(html);
    } catch (err) {
      setError(formatApiError(err, 'Gagal unduh PDF'));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Pesanan</h1>
          <p className="text-gray-500 text-sm mt-1">{total} transaksi ditemukan</p>
        </div>
        {total > 0 && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={downloadXlsx}
              disabled={!!downloading || loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {downloading === 'xlsx' ? '⏳' : '📊'} Excel
            </button>
            <button
              onClick={downloadPdf}
              disabled={!!downloading || loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {downloading === 'pdf' ? '⏳' : '📄'} PDF
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="date" className="input w-auto text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input w-auto text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          <select className="input w-auto text-sm" value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
            <option value="">Semua Platform</option>
            <option value="GRABFOOD">GrabFood</option>
            <option value="GOFOOD">GoFood</option>
            <option value="SHOPEEFOOD">ShopeeFood</option>
          </select>
          <button onClick={search} className="btn-primary flex items-center gap-2 text-sm">
            <Search className="w-4 h-4" /> Cari
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
        )}

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
                  <th className="pb-3 pr-3 text-right">Net Cair</th>
                  <th className="pb-3 pr-3 whitespace-nowrap">Tgl Transfer</th>
                  <th className="pb-3">ID Pencairan</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-gray-400">
                      Belum ada data
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const { jenis, metode, idPesanan, biayaJasa, biayaSukses, mdr, tanggalTransfer, idPencairan } =
                      parseItemMeta(o.items);
                    const netCair = calcNetCair(Number(o.grossSales), biayaJasa, biayaSukses, mdr);
                    return (
                      <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 pr-3 pl-4 md:pl-0 text-gray-600 whitespace-nowrap">
                          {formatDate(o.orderDate)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={MP_BADGE[o.marketplace] || 'badge-grabfood'}>
                            {MP_LABEL[o.marketplace] || o.marketplace}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-700 whitespace-nowrap">{jenis}</td>
                        <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap">{metode}</td>
                        <td className="py-2.5 pr-3 font-mono text-gray-400 whitespace-nowrap">
                          {idPesanan !== '-' ? idPesanan : '-'}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-medium">{formatRupiah(Number(o.grossSales))}</td>
                        <td className="py-2.5 pr-3 text-right text-red-500">
                          {biayaJasa > 0 ? `-${formatRupiah(biayaJasa)}` : '-'}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-orange-500">
                          {biayaSukses > 0 ? `-${formatRupiah(biayaSukses)}` : '-'}
                        </td>
                        <td className="py-2.5 pr-3 text-right text-orange-400">
                          {mdr > 0 ? `-${formatRupiah(mdr)}` : '-'}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-green-700">{formatRupiah(netCair)}</td>
                        <td
                          className="py-2.5 pr-3 text-gray-400 whitespace-nowrap text-xs"
                          title="Tanggal dana cair ke rekening"
                        >
                          {tanggalTransfer !== '-' ? tanggalTransfer : '-'}
                        </td>
                        <td className="py-2.5 font-mono text-gray-400 text-xs whitespace-nowrap">
                          {idPencairan !== '-' ? idPencairan : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {orders.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td colSpan={5} className="py-3 pl-4 md:pl-0 text-sm text-gray-600">
                      Total ({orders.length} transaksi)
                    </td>
                    <td className="py-3 pr-3 text-right text-sm">
                      {formatRupiah(orders.reduce((a, o) => a + Number(o.grossSales), 0))}
                    </td>
                    <td className="py-3 pr-3 text-right text-sm text-red-500">
                      -{formatRupiah(orders.reduce((a, o) => a + parseItemMeta(o.items).biayaJasa, 0))}
                    </td>
                    <td className="py-3 pr-3 text-right text-sm text-orange-500">
                      -{formatRupiah(orders.reduce((a, o) => a + parseItemMeta(o.items).biayaSukses, 0))}
                    </td>
                    <td className="py-3 pr-3 text-right text-sm text-orange-400">
                      -{formatRupiah(orders.reduce((a, o) => a + parseItemMeta(o.items).mdr, 0))}
                    </td>
                    <td className="py-3 pr-3 text-right text-sm text-green-700">
                      {formatRupiah(
                        orders.reduce((a, o) => {
                          const { biayaJasa, biayaSukses, mdr } = parseItemMeta(o.items);
                          return a + calcNetCair(Number(o.grossSales), biayaJasa, biayaSukses, mdr);
                        }, 0),
                      )}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Hal. {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary p-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary p-2"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
