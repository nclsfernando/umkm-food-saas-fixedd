import { Injectable, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

// Bulan Indonesia → nomor
const BULAN_ID: Record<string, string> = {
  'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
  'Mei': '05', 'Jun': '06', 'Jul': '07', 'Agu': '08',
  'Agus': '08', 'Sep': '09', 'Okt': '10', 'Nov': '11', 'Des': '12',
};

@Injectable()
export class ImportService {
  constructor(private orders: OrdersService, private prisma: PrismaService) {}

  async cleanDuplicates() {
    const all = await this.prisma.order.findMany({
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
      await this.prisma.orderItem.deleteMany({ where: { orderId: { in: toDelete } } });
      await this.prisma.order.deleteMany({ where: { id: { in: toDelete } } });
    }

    return { totalBefore: all.length, deleted: toDelete.length, totalAfter: all.length - toDelete.length };
  }

  async deleteAllOrders() {
    const count = await this.prisma.order.count();
    await this.prisma.orderItem.deleteMany({});
    await this.prisma.order.deleteMany({});
    return { deleted: count };
  }

  async importFile(buffer: Buffer, filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    let rows: any[] = [];

    if (ext === 'csv') {
      const text = buffer.toString('utf-8');
      rows = this.parseGrabCsv(text);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      rows = this.parseMarketplaceXlsx(wb, filename);
    } else {
      throw new BadRequestException('Format file tidak didukung. Gunakan CSV atau XLSX.');
    }

    if (rows.length === 0) throw new BadRequestException('Tidak ada data pesanan yang ditemukan di file. Pastikan format file sesuai.');
    return this.orders.importCsv(rows);
  }

  private parseMarketplaceXlsx(wb: XLSX.WorkBook, filename: string) {
    const name = filename.toLowerCase();

    // ── 1. Deteksi format "Laporan Marketplace" (aggregated harian) ──────────
    const laporanSheet = wb.SheetNames.find(s =>
      s.toLowerCase() === 'laporan' ||
      s.toLowerCase().includes('laporan marketplace') ||
      s.toLowerCase().includes('marketplace')
    );
    const isLaporanFilename = name.includes('laporan_marketplace') || name.includes('laporan marketplace');

    if (laporanSheet || isLaporanFilename) {
      // Cek kolom header — harus ada GrabFood / GoFood / ShopeeFood
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

    // ── 2. Deteksi berdasarkan nama file ────────────────────────────────────
    if (name.includes('grab') || name.includes('grabmerchant')) {
      return this.parseGrabXlsx(wb);
    }
    if (name.includes('gofood') || name.includes('gojek') || name.includes('gobiz')) {
      return this.parseGoFoodXlsx(wb);
    }
    if (name.includes('shopee')) {
      return this.parseShopeeXlsx(wb);
    }

    // ── 3. Auto-detect berdasarkan sheet names ──────────────────────────────
    const sheets = wb.SheetNames.map(s => s.toLowerCase());
    if (sheets.some(s => s.includes('transaksi') || s.includes('transaction'))) {
      return this.parseGrabXlsx(wb);
    }
    if (sheets.some(s => s.includes('rekap') || s.includes('rekapitulasi'))) {
      return this.parseGoFoodXlsx(wb);
    }

    // ── 4. Auto-detect dari kolom sheet pertama ──────────────────────────────
    const firstWs = wb.Sheets[wb.SheetNames[0]];
    if (firstWs) {
      const firstRaw: any[] = XLSX.utils.sheet_to_json(firstWs, { defval: 0 });
      if (firstRaw.length > 0) {
        const cols = Object.keys(firstRaw[0]).map(k => k.toLowerCase());
        if (cols.includes('kategori') && cols.includes('jumlah')) return this.parseGrabXlsx(wb);
        if (cols.some(c => c.includes('grabfood')) || cols.some(c => c.includes('gofood'))) {
          return this.parseLaporanMarketplace(wb, wb.SheetNames[0]);
        }
      }
    }

    return this.parseGrabXlsx(wb); // default fallback
  }

  // ── Parser: Format Laporan Marketplace Harian ────────────────────────────
  // Format: Sheet "Laporan", kolom: Tanggal | GrabFood | GoFood | ShopeeFood | Total
  // Baris: "27 Jun 2026", 90759, 0, 0, 90759
  // Skip baris: Total Juni 2026, GRAND TOTAL
  private parseLaporanMarketplace(wb: XLSX.WorkBook, sheetName: string) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: 0 });
    const orders: any[] = [];

    // Cari nama kolom yang tepat (case-insensitive)
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

      // Skip baris summary
      const tLower = tanggalRaw.toLowerCase();
      if (
        tLower.startsWith('total') ||
        tLower.startsWith('grand') ||
        tLower.startsWith('jumlah') ||
        tLower.startsWith('subtotal')
      ) continue;

      const orderDate = this.parseIndonesianDate(tanggalRaw);
      if (isNaN(orderDate.getTime())) continue;

      // Temukan nama kolom dari baris pertama
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

  // ── Parser: GrabMerchant XLSX (sheet "Transaksi") ─────────────────────────
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
      const netSales = parseFloat(String(row['Total'] || '0').replace(/,/g, '')) || (jumlah - commission);

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

  // ── Parser: GoFood/GoBiz XLSX ─────────────────────────────────────────────
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
    const orders: any[] = [];

    for (const row of raw) {
      const grossSales = parseFloat(String(
        row['Penjualan'] || row['Harga Menu'] || row['Subtotal'] ||
        row['Total Harga'] || row['Nilai Pesanan'] || row['Gross Amount'] || '0'
      ).replace(/,/g, '')) || 0;
      if (grossSales <= 0) continue;

      const biayaGoFood = Math.abs(parseFloat(String(row['Biaya GoFood'] || row['Komisi'] || row['Commission'] || '0').replace(/,/g, '')) || 0);
      const biayaProgram = Math.abs(parseFloat(String(row['Biaya Program'] || '0').replace(/,/g, '')) || 0);
      const totalBiaya = Math.abs(parseFloat(String(row['Total Biaya'] || '0').replace(/,/g, '')) || (biayaGoFood + biayaProgram));
      const pendapatanBersih = parseFloat(String(row['Pendapatan Bersih'] || '0').replace(/,/g, '')) || (grossSales - totalBiaya);
      const nomorPesanan = String(row['Nomor pesanan'] || row['No. Pesanan'] || row['Order ID'] || '').replace(/^'/, '').trim();
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

  // ── Parser: ShopeeFood XLSX ───────────────────────────────────────────────
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

  // ── Parser: CSV GrabFood ──────────────────────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Parse tanggal Indonesia: "27 Jun 2026" → Date */
  private parseIndonesianDate(raw: string): Date {
    const str = String(raw).trim();
    const parts = str.split(/\s+/);
    if (parts.length === 3) {
      const [day, monthStr, year] = parts;
      const month = BULAN_ID[monthStr] || BULAN_ID[monthStr.slice(0,3)];
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
