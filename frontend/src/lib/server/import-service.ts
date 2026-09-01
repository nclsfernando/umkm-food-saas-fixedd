import * as XLSX from 'xlsx';
import { prisma } from '@/lib/db';
import { importCsvRows } from '@/lib/server/orders';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Bulan Indonesia -> nomor
const BULAN_ID: Record<string, string> = {
  'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
  'Mei': '05', 'Jun': '06', 'Jul': '07', 'Agu': '08',
  'Agus': '08', 'Sep': '09', 'Okt': '10', 'Nov': '11', 'Des': '12',
};

export class ImportService {
  constructor() {}

  async cleanDuplicates() {
    const all = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    const seen = new Set<string>();
    const toDelete: string[] = [];

    for (const order of all) {
      const dateKey = order.orderDate.toISOString().split('T')[0];
      let idPesanan = '';
      try {
        const meta = JSON.parse(order.items?.[0]?.productName || '{}');
        idPesanan = meta.idPesanan || '';
      } catch { /* old format */ }

      const key = `${order.marketplace}|${dateKey}|${order.grossSales}|${idPesanan}`;
      if (seen.has(key)) {
        toDelete.push(order.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: toDelete } } });
      await prisma.order.deleteMany({ where: { id: { in: toDelete } } });
    }

    return { totalBefore: all.length, deleted: toDelete.length, totalAfter: all.length - toDelete.length };
  }

  async recalculateNetSales() {
    const orders = await prisma.order.findMany({
      select: { id: true, grossSales: true, commission: true },
    });
    let updated = 0;
    for (const o of orders) {
      const net = Number(o.grossSales) - Number(o.commission);
      await prisma.order.update({
        where: { id: o.id },
        data: { netSales: net.toString() },
      });
      updated++;
    }
    return { updated };
  }

  async deleteAllOrders() {
    const count = await prisma.order.count();
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    return { deleted: count };
  }

  async importFile(buffer: Buffer, filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    let rows: any[] = [];

    if (ext === 'csv') {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : [];
      if (raw.length > 0 && this.isGrabStoreSummary(Object.keys(raw[0]))) {
        rows = this.parseGrabStoreSummary(raw, filename);
      } else if (raw.length > 0 && this.isGoFoodCsv(Object.keys(raw[0]))) {
        rows = this.parseGoFoodCsv(raw);
      } else if (raw.length > 0 && this.isGrabTransactionExport(Object.keys(raw[0]))) {
        rows = this.parseGrabTransactionExport(raw);
      } else {
        rows = this.parseGrabCsv(buffer.toString('utf-8'));
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      rows = this.parseMarketplaceXlsx(wb, filename);
    } else {
      throw new HttpError(400, 'Format file tidak didukung. Gunakan CSV atau XLSX.');
    }

    if (rows.length === 0) throw new HttpError(400, 'Tidak ada data pesanan yang ditemukan di file. Pastikan format file sesuai.');
    return importCsvRows(rows);
  }

  private parseMarketplaceXlsx(wb: XLSX.WorkBook, filename: string) {
    const name = filename.toLowerCase();

    // â”€â”€ 0. GrabFood Transaction Stores Summary / GoFood settlement columns â”€â”€
    const firstWs = wb.Sheets[wb.SheetNames[0]];
    if (firstWs) {
      const firstRaw: any[] = XLSX.utils.sheet_to_json(firstWs, { defval: '' });
      if (firstRaw.length > 0 && this.isGrabStoreSummary(Object.keys(firstRaw[0]))) {
        return this.parseGrabStoreSummary(firstRaw, filename);
      }
      if (firstRaw.length > 0 && this.isGoFoodCsv(Object.keys(firstRaw[0]))) {
        return this.parseGoFoodCsv(firstRaw);
      }
      if (firstRaw.length > 0 && this.isGrabTransactionExport(Object.keys(firstRaw[0]))) {
        return this.parseGrabTransactionExport(firstRaw);
      }
    }

    // â”€â”€ 1. Deteksi format "Laporan Marketplace" (aggregated harian) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const laporanSheet = wb.SheetNames.find(s =>
      s.toLowerCase() === 'laporan' ||
      s.toLowerCase().includes('laporan marketplace') ||
      s.toLowerCase().includes('marketplace')
    );
    const isLaporanFilename = name.includes('laporan_marketplace') || name.includes('laporan marketplace');

    if (laporanSheet || isLaporanFilename) {
      const targetSheet = laporanSheet || wb.SheetNames[0];
      const ws = wb.Sheets[targetSheet];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: 0, range: 0 });
      if (raw.length > 0) {
        const cols = Object.keys(raw[0]).map(k => k.toLowerCase());
        const isLaporanFormat =
          cols.some(c => c.includes('grabfood') || c.includes('grab food')) ||
          cols.some(c => c.includes('gofood') || c.includes('go food')) ||
          cols.some(c => c.includes('shopeefood') || c.includes('shopee food'));
        if (isLaporanFormat) {
          return this.parseLaporanMarketplace(wb, targetSheet);
        }
      }
    }

    // â”€â”€ 2. Deteksi berdasarkan nama file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (name.includes('grab') || name.includes('grabmerchant')) {
      return this.parseGrabXlsx(wb);
    }
    if (name.includes('gofood') || name.includes('gojek') || name.includes('gobiz')) {
      return this.parseGoFoodXlsx(wb);
    }
    if (name.includes('shopee')) {
      return this.parseShopeeXlsx(wb);
    }

    // â”€â”€ 3. Auto-detect berdasarkan sheet names â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const sheets = wb.SheetNames.map(s => s.toLowerCase());
    if (sheets.some(s => s.includes('transaksi') || s.includes('transaction'))) {
      return this.parseGrabXlsx(wb);
    }
    if (sheets.some(s => s.includes('rekap') || s.includes('rekapitulasi'))) {
      return this.parseGoFoodXlsx(wb);
    }

    // â”€â”€ 4. Auto-detect dari kolom sheet pertama â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (firstWs) {
      const firstRaw: any[] = XLSX.utils.sheet_to_json(firstWs, { defval: 0 });
      if (firstRaw.length > 0) {
        if (this.isGoFoodCsv(Object.keys(firstRaw[0]))) return this.parseGoFoodCsv(firstRaw);
        const cols = Object.keys(firstRaw[0]).map(k => k.toLowerCase());
        if (cols.includes('kategori') && cols.includes('jumlah')) return this.parseGrabXlsx(wb);
        if (cols.some(c => c.includes('grabfood')) || cols.some(c => c.includes('gofood'))) {
          return this.parseLaporanMarketplace(wb, wb.SheetNames[0]);
        }
      }
    }

    return this.parseGrabXlsx(wb);
  }

  /** Grab merchant portal: Download transactions â†’ Summary */
  private isGrabStoreSummary(cols: string[]): boolean {
    const n = cols.map(c => c.toLowerCase().replace(/\s+/g, '').replace(/^\ufeff/, ''));
    const hasStore = n.some(c => c === 'store' || c === 'toko' || c === 'outlet');
    const hasNet = n.some(c => c === 'nettotal' || c.includes('nettotal') || c === 'net');
    const hasOrders = n.some(c => c === 'orders' || c === 'pesanan' || c === 'order');
    const hasPay = n.some(c =>
      c.includes('grabpay') ||
      c.includes('ovo') ||
      c.includes('paymentvalue') ||
      c.includes('payments')
    );
    return hasStore && hasNet && (hasOrders || hasPay);
  }

  /** Grab merchant portal: Download transactions → detailed export (Transaction_Store_*.csv) */
  private isGrabTransactionExport(cols: string[]): boolean {
    const n = cols.map((c) => c.toLowerCase().replace(/\s+/g, '').replace(/^\ufeff/, ''));
    const hasTxId = n.some((c) => c === 'transactionid' || c.endsWith('transactionid'));
    const hasNetSales = n.some((c) => c === 'netsales' || c.includes('netsales'));
    const hasType = n.some((c) => c === 'type');
    const hasStore = n.some((c) => c.includes('storename') || c === 'merchantname');
    return hasTxId && hasNetSales && (hasType || hasStore);
  }

  /**
   * Grab detailed transaction CSV/XLSX (Merchant/Store/Transaction ID/Net Sales/Total).
   * Skips GrabFinance loans; imports GrabFood + OVO Payment rows.
   */
  private parseGrabTransactionExport(raw: any[]) {
    const orders: any[] = [];

    for (const row of raw) {
      const type = String(row['Type'] || '').trim();
      const category = String(row['Category'] || '').trim();
      const status = String(row['Status'] || '').trim();

      if (type === 'GrabFinance') continue;
      if (category && category.toLowerCase() !== 'payment') continue;
      if (status && !['completed', 'transferred'].includes(status.toLowerCase())) continue;

      const netSalesCol = this.parseAmount(this.pickValue(row, ['Net Sales', 'NetSales']));
      const totalCol = this.parseAmount(this.pickValue(row, ['Total']));
      if (netSalesCol <= 0 && totalCol <= 0) continue;

      const grossSales = netSalesCol > 0 ? netSalesCol : totalCol;
      const netSales = totalCol > 0 ? totalCol : netSalesCol;
      const commission = Math.max(0, Number((grossSales - netSales).toFixed(2)));

      const txId = this.pickValue(row, ['Transaction ID', 'TransactionID']).trim();
      const shortOrder = this.pickValue(row, ['Short Order ID', 'Short Order ID', 'Long Order ID']).trim();
      const idPesanan = shortOrder || txId;
      if (!idPesanan) continue;

      const store = this.pickValue(row, ['Store Name', 'Merchant Name', 'Store']).trim();
      const paymentMethod = this.pickValue(row, ['Payment Method', 'Order Channel', 'Channel']).trim();

      const itemMeta = JSON.stringify({
        jenis: type || 'GrabFood',
        metode: paymentMethod || type || 'GrabPay',
        idPesanan,
        store,
        biayaJasa: commission,
        biayaSukses: 0,
        mdr: 0,
        tanggalTransfer: this.pickValue(row, ['Transfer Date']).trim(),
        idPencairan: this.pickValue(row, ['Settlement ID']).trim(),
      });

      orders.push({
        orderDate: this.parseDate(row['Created On'] || row['Updated On'] || row['Diperbarui Pada'] || ''),
        marketplace: 'GRABFOOD',
        grossSales,
        discount: 0,
        commission,
        netSales: netSales > 0 ? netSales : grossSales - commission,
        status: 'COMPLETED',
        items: [{ productName: itemMeta, qty: 1, unitPrice: grossSales, subtotal: grossSales }],
      });
    }
    return orders;
  }

  /** GoFood / GoBiz settlement export (CSV or XLSX with same columns) */
  private isGoFoodCsv(cols: string[]): boolean {
    const n = cols.map(c => c.toLowerCase().replace(/\s+/g, '').replace(/^\ufeff/, ''));
    const hasMerchant = n.some(c => c === 'merchantid' || c.includes('merchantid'));
    const hasWaktu = n.some(c => c === 'waktutransaksi' || c.includes('waktutransaksi'));
    const hasPenjualan = n.some(c => c === 'penjualan');
    const hasPendapatan = n.some(c => c === 'pendapatanbersih' || c.includes('pendapatanbersih'));
    const hasBiayaGoFood = n.some(c => c.includes('biayagofood'));
    const hasNomor = n.some(c => c === 'nomorpesanan' || c.includes('nomorpesanan'));
    return hasPenjualan && (hasPendapatan || hasBiayaGoFood) && (hasMerchant || hasNomor || hasWaktu);
  }

  private parseYmd(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private parsePeriodFromFilename(filename: string): {
    from: Date;
    to: Date;
    granularity: 'daily' | 'monthly' | 'range';
  } {
    const match = filename.match(/(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})/i);
    if (match) {
      const from = this.parseYmd(match[1]);
      const to = this.parseYmd(match[2]);
      const sameDay = match[1] === match[2];
      const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
      return { from, to, granularity: sameDay ? 'daily' : sameMonth ? 'monthly' : 'range' };
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return { from: now, to: now, granularity: 'daily' };
  }

  /** Pecah rentang tanggal jadi potongan per bulan (untuk rekap multi-bulan). */
  private monthChunks(from: Date, to: Date): { start: Date; end: Date; days: number; yyyyMm: string }[] {
    const chunks: { start: Date; end: Date; days: number; yyyyMm: string }[] = [];
    let y = from.getFullYear();
    let m = from.getMonth();
    const endY = to.getFullYear();
    const endM = to.getMonth();
    while (y < endY || (y === endY && m <= endM)) {
      const monthStart = new Date(y, m, 1);
      const monthEnd = new Date(y, m + 1, 0);
      const start = from > monthStart ? from : monthStart;
      const end = to < monthEnd ? to : monthEnd;
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      chunks.push({
        start,
        end,
        days,
        yyyyMm: `${y}-${String(m + 1).padStart(2, '0')}`,
      });
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    return chunks;
  }

  private splitAmount(total: number, weights: number[]): number[] {
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const parts = weights.map(w => Number(((total * w) / sum).toFixed(2)));
    const drift = Number((total - parts.reduce((a, b) => a + b, 0)).toFixed(2));
    parts[parts.length - 1] = Number((parts[parts.length - 1] + drift).toFixed(2));
    return parts;
  }

  private splitInt(total: number, weights: number[]): number[] {
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const parts = weights.map(w => Math.floor((total * w) / sum));
    parts[parts.length - 1] += total - parts.reduce((a, b) => a + b, 0);
    return parts;
  }

  private pickCol(row: any, candidates: string[]): string {
    const keys = Object.keys(row);
    for (const c of candidates) {
      const want = c.toLowerCase().replace(/\s/g, '');
      const found = keys.find(k => k.toLowerCase().replace(/\s/g, '').replace(/^\ufeff/, '') === want);
      if (found) return found;
    }
    return '';
  }

  private pickValue(row: any, candidates: string[]): string {
    const col = this.pickCol(row, candidates);
    return col ? String(row[col] ?? '') : '';
  }

  private parseAmount(raw: any): number {
    if (raw === null || raw === undefined || raw === '') return 0;
    const n = parseFloat(String(raw).replace(/,/g, '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  // â”€â”€ Parser: GrabFood Summary (Store / City / GrabPay|OVO / Orders / Net Total)
  // File: Transaction_Stores_YYYY-MM-DD_to_YYYY-MM-DD_*.csv
  // 1 bulan â†’ 1 rekap. Beberapa bulan â†’ dipecah otomatis 1 rekap per bulan.
  private parseGrabStoreSummary(raw: any[], filename: string) {
    const { from, to, granularity } = this.parsePeriodFromFilename(filename);
    const chunks = this.monthChunks(from, to);
    const weights = chunks.map(c => c.days);
    const orders: any[] = [];

    for (const row of raw) {
      const store = this.pickValue(row, ['Store', 'Toko', 'Outlet']).trim();
      if (!store) continue;
      const storeLower = store.toLowerCase();
      if (storeLower === 'store' || storeLower.startsWith('total') || storeLower.startsWith('grand')) continue;

      const city = this.pickValue(row, ['City', 'Kota']).trim();
      const netTotal = this.parseAmount(this.pickValue(row, ['Net Total', 'NetTotal', 'Net']));
      const paymentValue = this.parseAmount(this.pickValue(row, ['Payment Value', 'PaymentValue', 'Gross Sales', 'Gross']));
      const orderCount = Math.round(this.parseAmount(this.pickValue(row, ['Orders', 'Pesanan', 'Order'])));
      const grabPayCol = this.pickCol(row, ['GrabPay payments', 'GrabPay Payments', 'GrabPay']);
      const ovoCol = this.pickCol(row, ['OVO Payments', 'OVO payments', 'OVO']);
      const payCount = Math.round(this.parseAmount(row[grabPayCol || ovoCol] ?? 0));

      if (netTotal <= 0 && paymentValue <= 0) continue;

      const grossSales = paymentValue > 0 ? paymentValue : netTotal;
      const netSales = netTotal > 0 ? netTotal : grossSales;
      const storeSlug = store.replace(/\s+/g, '-').slice(0, 48);
      const metode = grabPayCol ? 'GrabPay' : ovoCol ? 'OVO' : 'GrabFood';
      const netParts = this.splitAmount(netSales, weights);
      const grossParts = this.splitAmount(grossSales, weights);
      const qtyParts = this.splitInt(orderCount > 0 ? orderCount : chunks.length, weights);
      const payParts = this.splitInt(payCount, weights);

      chunks.forEach((chunk, i) => {
        const monthNet = netParts[i];
        const monthGross = grossParts[i];
        if (monthNet <= 0 && monthGross <= 0) return;
        const commission = Math.max(0, Number((monthGross - monthNet).toFixed(2)));
        const qty = Math.max(1, qtyParts[i] || 1);
        const periodFrom = this.ymd(chunk.start);
        const periodTo = this.ymd(chunk.end);
        const idPesanan = granularity === 'daily'
          ? `GRABFOOD-SUMMARY-${storeSlug}-${periodFrom}`
          : `GRABFOOD-SUMMARY-${storeSlug}-${chunk.yyyyMm}`;
        const jenis = granularity === 'daily'
          ? 'GrabFood Daily Summary'
          : 'GrabFood Monthly Summary';

        orders.push({
          orderDate: chunk.start,
          marketplace: 'GRABFOOD',
          grossSales: monthGross,
          discount: 0,
          commission,
          netSales: monthNet,
          status: 'COMPLETED',
          items: [{
            productName: JSON.stringify({
              jenis,
              metode,
              idPesanan,
              store,
              city,
              orders: qty,
              grabPayPayments: payParts[i],
              paymentValue: monthGross,
              netTotal: monthNet,
              periodFrom,
              periodTo,
              recapFrom: this.ymd(from),
              recapTo: this.ymd(to),
              granularity,
              biayaJasa: commission,
              biayaSukses: 0,
              mdr: 0,
              tanggalTransfer: `${periodFrom} s/d ${periodTo}`,
              idPencairan: '',
            }),
            qty,
            unitPrice: Number((monthNet / qty).toFixed(2)),
            subtotal: monthNet,
          }],
        });
      });
    }
    return orders;
  }

  // â”€â”€ Parser: Format Laporan Marketplace Harian â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private parseLaporanMarketplace(wb: XLSX.WorkBook, sheetName: string) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: 0 });
    const orders: any[] = [];

    const findCol = (row: any, candidates: string[]): string => {
      const keys = Object.keys(row);
      for (const c of candidates) {
        const found = keys.find(k => k.toLowerCase().replace(/\s/g, '') === c.toLowerCase().replace(/\s/g, ''));
        if (found) return found;
      }
      return '';
    };

    const PLATFORMS = [
      { candidates: ['GrabFood', 'Grab Food', 'Grabfood'], marketplace: 'GRABFOOD' },
      { candidates: ['GoFood', 'Go Food', 'Gofood'], marketplace: 'GOFOOD' },
      { candidates: ['ShopeeFood', 'Shopee Food', 'Shopeefood'], marketplace: 'SHOPEEFOOD' },
    ];

    for (const row of raw) {
      const tanggalRaw = String(row['Tanggal'] || row['tanggal'] || '').trim();
      if (!tanggalRaw) continue;

      const tLower = tanggalRaw.toLowerCase();
      if (
        tLower.startsWith('total') ||
        tLower.startsWith('grand') ||
        tLower.startsWith('jumlah') ||
        tLower.startsWith('subtotal')
      ) continue;

      const orderDate = this.parseIndonesianDate(tanggalRaw);
      if (isNaN(orderDate.getTime())) continue;

      for (const { candidates, marketplace } of PLATFORMS) {
        const colName = findCol(row, candidates);
        if (!colName) continue;
        const amount = parseFloat(String(row[colName] || '0').replace(/,/g, '')) || 0;
        if (amount <= 0) continue;

        const idPesanan = `${marketplace}-${tanggalRaw.replace(/\s/g, '-')}`;

        orders.push({
          orderDate,
          marketplace,
          grossSales: amount,
          discount: 0,
          commission: 0,
          netSales: amount,
          status: 'COMPLETED',
          items: [{
            productName: JSON.stringify({
              jenis: `${colName} Daily`,
              metode: 'Transfer/Pencairan',
              idPesanan,
              biayaJasa: 0,
              biayaSukses: 0,
              mdr: 0,
              tanggalTransfer: tanggalRaw,
              idPencairan: '',
            }),
            qty: 1,
            unitPrice: amount,
            subtotal: amount,
          }],
        });
      }
    }
    return orders;
  }

  // â”€â”€ Parser: GrabMerchant XLSX (sheet "Transaksi") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private parseGrabXlsx(wb: XLSX.WorkBook) {
    const sheetName =
      wb.SheetNames.find(s =>
        s.toLowerCase().includes('transaksi') ||
        s.toLowerCase().includes('transaction')
      ) || wb.SheetNames[1] || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const orders: any[] = [];

    for (const row of raw) {
      const kategori = String(row['Kategori'] || '').trim();
      if (kategori !== 'Pembayaran') continue;

      const jumlah = parseFloat(String(row['Jumlah'] || '0').replace(/,/g, '')) || 0;
      if (jumlah <= 0) continue;

      const jenis = String(row['Jenis'] || '').trim();
      const metodePembayaran = String(row['Metode pembayaran'] || '').trim();
      const idPesanan = String(row['ID pesanan pendek'] || '').trim();
      const idTransaksi = String(row['ID transaksi'] || '').trim();
      const idPencairan = String(row['ID pencairan dana'] || '').trim();
      const tanggalTransfer = String(row['Tanggal transfer'] || '').trim();

      const biayaJasa = Math.abs(parseFloat(String(row['Biaya jasa'] || '0').replace(/,/g, '')) || 0);
      const biayaSukses = Math.abs(parseFloat(String(row['Biaya sukses pemasaran'] || '0').replace(/,/g, '')) || 0);
      const mdr = Math.abs(parseFloat(String(row['Nilai MDR bersih'] || '0').replace(/,/g, '')) || 0);
      const commission = biayaJasa + biayaSukses + mdr;
      const netSales = jumlah - commission;

      const itemMeta = JSON.stringify({
        jenis,
        metode: metodePembayaran,
        idPesanan: idPesanan || idTransaksi,
        biayaJasa,
        biayaSukses,
        mdr,
        tanggalTransfer,
        idPencairan,
      });

      orders.push({
        orderDate: this.parseDate(row['Tanggal dibuat'] || row['Diperbarui Pada'] || ''),
        marketplace: 'GRABFOOD',
        grossSales: jumlah,
        discount: 0,
        commission,
        netSales: netSales > 0 ? netSales : jumlah - commission,
        status: 'COMPLETED',
        items: [{ productName: itemMeta, qty: 1, unitPrice: jumlah, subtotal: jumlah }],
      });
    }
    return orders;
  }

  // â”€â”€ Parser: GoFood/GoBiz settlement rows (CSV sheet_to_json or XLSX) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private parseGoFoodCsv(raw: any[]) {
    const orders: any[] = [];

    for (const row of raw) {
      const grossSales = this.parseAmount(
        row['Penjualan'] || row['Harga Menu'] || row['Subtotal'] ||
        row['Total Harga'] || row['Nilai Pesanan'] || row['Gross Amount'] || 0
      );
      if (grossSales <= 0) continue;

      const biayaGoFood = Math.abs(this.parseAmount(row['Biaya GoFood'] || row['Komisi'] || row['Commission'] || 0));
      const biayaProgram = Math.abs(this.parseAmount(row['Biaya Program'] || 0));
      const totalBiayaRaw = this.parseAmount(row['Total Biaya'] || '');
      const totalBiaya = Math.abs(totalBiayaRaw > 0 ? totalBiayaRaw : (biayaGoFood + biayaProgram));
      const pendapatanRaw = this.parseAmount(row['Pendapatan Bersih'] || '');
      const pendapatanBersih = pendapatanRaw > 0 ? pendapatanRaw : (grossSales - totalBiaya);
      const nomorPesanan = String(row['Nomor pesanan'] || row['No. Pesanan'] || row['Order ID'] || '')
        .replace(/^'/, '')
        .trim();
      const namaProgram = String(row['Nama Program'] || '').trim();
      const merchantId = String(row['Merchant ID'] || '').trim();

      const itemMeta = JSON.stringify({
        jenis: 'GoFood',
        metode: namaProgram || 'GoPay',
        idPesanan: nomorPesanan,
        biayaJasa: biayaGoFood,
        biayaSukses: biayaProgram,
        mdr: 0,
        tanggalTransfer: '',
        idPencairan: merchantId,
      });

      orders.push({
        orderDate: this.parseDate(row['Waktu transaksi'] || row['Tanggal'] || row['Order Date'] || ''),
        marketplace: 'GOFOOD',
        grossSales,
        discount: 0,
        commission: totalBiaya,
        netSales: pendapatanBersih > 0 ? pendapatanBersih : grossSales - totalBiaya,
        status: 'COMPLETED',
        items: [{ productName: itemMeta, qty: 1, unitPrice: grossSales, subtotal: grossSales }],
      });
    }
    return orders;
  }

  // â”€â”€ Parser: GoFood/GoBiz XLSX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private parseGoFoodXlsx(wb: XLSX.WorkBook) {
    const sheetName =
      wb.SheetNames.find(s =>
        s.toLowerCase().includes('midtrans') ||
        s.toLowerCase().includes('payment') ||
        s.toLowerCase().includes('order') ||
        s.toLowerCase().includes('rekap') ||
        s.toLowerCase().includes('transaksi')
      ) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return this.parseGoFoodCsv(raw);
  }

  // â”€â”€ Parser: ShopeeFood XLSX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private parseShopeeXlsx(wb: XLSX.WorkBook) {
    const sheetName =
      wb.SheetNames.find(s =>
        s.toLowerCase().includes('order') ||
        s.toLowerCase().includes('pesanan') ||
        s.toLowerCase().includes('transaksi')
      ) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const orders: any[] = [];

    for (const row of raw) {
      const grossSales = parseFloat(
        row['Total Pembayaran'] || row['Harga Setelah Diskon'] ||
        row['Subtotal Produk'] || row['Total Harga'] ||
        row['Nilai Pesanan'] || row['Order Total'] || 0
      );
      if (!grossSales) continue;

      const commission = Math.abs(parseFloat(
        row['Biaya Komisi'] || row['Komisi Shopee'] ||
        row['Biaya Platform'] || row['Commission Fee'] || 0
      ));
      const discount = Math.abs(parseFloat(
        row['Diskon Voucher Shopee'] || row['Diskon'] ||
        row['Promo'] || row['Discount'] || 0
      ));
      const tanggal = row['Waktu Pesanan Dibuat'] || row['Tanggal Pesanan'] ||
        row['Order Time'] || row['Create Time'] || new Date().toISOString();
      const orderId = row['No. Pesanan'] || row['Order ID'] || '';

      orders.push({
        orderDate: new Date(tanggal),
        marketplace: 'SHOPEEFOOD',
        grossSales,
        discount,
        commission,
        netSales: grossSales - discount - commission,
        status: 'COMPLETED',
        items: [{
          productName: `ShopeeFood Order ${orderId}`,
          qty: 1,
          unitPrice: grossSales,
          subtotal: grossSales,
        }],
      });
    }
    return orders;
  }

  // â”€â”€ Parser: CSV GrabFood â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private parseGrabCsv(text: string) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const orders: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((h, idx) => row[h] = cols[idx] || '');

      const grossSales = parseFloat(row['Jumlah'] || row['Amount'] || row['Total'] || 0);
      if (!grossSales) continue;

      orders.push({
        orderDate: new Date(row['Tanggal dibuat'] || row['Date'] || new Date()),
        marketplace: 'GRABFOOD',
        grossSales,
        discount: 0,
        commission: Math.abs(parseFloat(row['Biaya jasa'] || 0)),
        netSales: parseFloat(row['Penjualan bersih'] || grossSales),
        status: 'COMPLETED',
        items: [{
          productName: `GrabFood Order ${row['ID pesanan pendek'] || ''}`,
          qty: 1,
          unitPrice: grossSales,
          subtotal: grossSales,
        }],
      });
    }
    return orders;
  }

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Parse tanggal Indonesia: "27 Jun 2026" â†’ Date */
  private parseIndonesianDate(raw: string): Date {
    const str = String(raw).trim();
    const parts = str.split(/\s+/);
    if (parts.length === 3) {
      const [day, monthStr, year] = parts;
      const month = BULAN_ID[monthStr] || BULAN_ID[monthStr.slice(0, 3)];
      if (month) {
        const d = new Date(`${year}-${month}-${day.padStart(2, '0')}T00:00:00Z`);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return this.parseDate(raw);
  }

  private parseDate(raw: any): Date {
    if (!raw) return new Date();
    if (raw instanceof Date) return raw;
    const str = String(raw).trim();
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    const match = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) return new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
    return this.parseIndonesianDate(str);
  }
}

const importService = new ImportService();

export async function importFile(buffer: Buffer, filename: string) {
  return importService.importFile(buffer, filename);
}

export async function cleanDuplicates() {
  return importService.cleanDuplicates();
}

export async function deleteAllOrders() {
  return importService.deleteAllOrders();
}
