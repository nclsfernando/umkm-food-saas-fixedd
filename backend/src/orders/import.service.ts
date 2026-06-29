import { Injectable, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ImportService {
  constructor(private orders: OrdersService) {}

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

    if (rows.length === 0) throw new BadRequestException('Tidak ada data pesanan yang ditemukan di file.');
    return this.orders.importCsv(rows);
  }

  private parseMarketplaceXlsx(wb: XLSX.WorkBook, filename: string) {
    const name = filename.toLowerCase();
    if (name.includes('grab') || name.includes('grabmerchant')) {
      return this.parseGrabXlsx(wb);
    } else if (name.includes('gofood') || name.includes('gojek')) {
      return this.parseGoFoodXlsx(wb);
    } else if (name.includes('shopee')) {
      return this.parseShopeeXlsx(wb);
    }
    // Try auto-detect by sheet names
    const sheets = wb.SheetNames.map(s => s.toLowerCase());
    if (sheets.some(s => s.includes('transaksi') || s.includes('transaction'))) {
      return this.parseGrabXlsx(wb);
    }
    if (sheets.some(s => s.includes('rekap') || s.includes('rekapitulasi'))) {
      return this.parseGoFoodXlsx(wb);
    }
    return this.parseGrabXlsx(wb); // default fallback
  }

  private parseGrabXlsx(wb: XLSX.WorkBook) {
    // GrabFood: Sheet "Transaksi" - simpan per baris transaksi
    const sheetName = wb.SheetNames.find(s => s.toLowerCase().includes('transaksi') || s.toLowerCase().includes('transaction')) || wb.SheetNames[1];
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
      const statusRow = String(row['Status'] || 'Ditransfer').trim();
      const saluranPesanan = String(row['Saluran pesanan'] || '').trim();

      const biayaJasa = Math.abs(parseFloat(String(row['Biaya jasa'] || '0').replace(/,/g, '')) || 0);
      const biayaSukses = Math.abs(parseFloat(String(row['Biaya sukses pemasaran'] || '0').replace(/,/g, '')) || 0);
      const mdr = Math.abs(parseFloat(String(row['Nilai MDR bersih'] || '0').replace(/,/g, '')) || 0);
      const commission = biayaJasa + biayaSukses + mdr;
      const netSales = parseFloat(String(row['Total'] || '0').replace(/,/g, '')) || (jumlah - commission);

      // Encode semua detail ke productName sebagai JSON string
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

  private parseGoFoodXlsx(wb: XLSX.WorkBook) {
    // GoFood/GoBiz: Sheet "Midtrans Payments" atau sheet lain
    const sheetName = wb.SheetNames.find(s =>
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

  private parseShopeeXlsx(wb: XLSX.WorkBook) {
    // ShopeeFood: common sheet names
    const sheetName = wb.SheetNames.find(s =>
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

  private parseGrabCsv(text: string) {
    // CSV fallback - simple parsing
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

  private parseDate(raw: any): Date {
    if (!raw) return new Date();
    if (raw instanceof Date) return raw;
    const str = String(raw).trim();
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
    const match = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) return new Date(`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`);
    return new Date();
  }
}
