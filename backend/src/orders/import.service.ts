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
    // GrabFood: Sheet "Transaksi"
    const sheetName = wb.SheetNames.find(s => s.toLowerCase().includes('transaksi') || s.toLowerCase().includes('transaction')) || wb.SheetNames[1];
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const orders: any[] = [];

    for (const row of raw) {
      const jenis = row['Jenis'] || row['Type'] || '';
      const status = row['Status'] || '';
      const kategori = row['Kategori'] || row['Category'] || '';

      // Only process GrabFood payment rows
      if (jenis !== 'GrabFood' && !String(jenis).toLowerCase().includes('grabfood')) continue;
      if (kategori !== 'Pembayaran' && !String(kategori).toLowerCase().includes('payment')) continue;

      const grossSales = parseFloat(row['Jumlah'] || row['Amount'] || 0);
      const commission = Math.abs(parseFloat(row['Biaya jasa'] || row['Service Fee'] || 0));
      const biayaSukses = Math.abs(parseFloat(row['Biaya sukses pemasaran'] || 0));
      const totalCommission = commission + biayaSukses;
      const netSales = parseFloat(row['Penjualan bersih'] || row['Net Sales'] || grossSales);

      if (!grossSales) continue;

      const tanggal = row['Tanggal dibuat'] || row['Created Date'] || row['Diperbarui Pada'] || new Date().toISOString();
      const orderId = row['ID pesanan pendek'] || row['Short Order ID'] || row['ID transaksi'] || '';

      orders.push({
        orderDate: new Date(tanggal),
        marketplace: 'GrabFood',
        grossSales,
        discount: 0,
        commission: totalCommission,
        netSales: netSales > 0 ? netSales : grossSales - totalCommission,
        status: 'COMPLETED',
        items: [{
          productName: `GrabFood Order ${orderId}`,
          qty: 1,
          unitPrice: grossSales,
          subtotal: grossSales,
        }],
      });
    }
    return orders;
  }

  private parseGoFoodXlsx(wb: XLSX.WorkBook) {
    // GoFood/GoBiz: Try common sheet names
    const sheetName = wb.SheetNames.find(s =>
      s.toLowerCase().includes('order') ||
      s.toLowerCase().includes('rekap') ||
      s.toLowerCase().includes('transaksi')
    ) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const orders: any[] = [];

    for (const row of raw) {
      // GoFood column names
      const grossSales = parseFloat(
        row['Harga Menu'] || row['Subtotal'] || row['Total Harga'] ||
        row['Nilai Pesanan'] || row['Gross Amount'] || 0
      );
      if (!grossSales) continue;

      const commission = Math.abs(parseFloat(
        row['Komisi'] || row['Commission'] || row['Biaya Platform'] || 0
      ));
      const discount = Math.abs(parseFloat(
        row['Diskon'] || row['Discount'] || 0
      ));

      const tanggal = row['Tanggal'] || row['Waktu Pesanan'] || row['Order Date'] || row['Tanggal Pesanan'] || new Date().toISOString();
      const orderId = row['No. Pesanan'] || row['Order ID'] || row['ID Pesanan'] || '';

      orders.push({
        orderDate: new Date(tanggal),
        marketplace: 'GoFood',
        grossSales,
        discount,
        commission,
        netSales: grossSales - discount - commission,
        status: 'COMPLETED',
        items: [{
          productName: `GoFood Order ${orderId}`,
          qty: 1,
          unitPrice: grossSales,
          subtotal: grossSales,
        }],
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
        marketplace: 'ShopeeFood',
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
        marketplace: 'GrabFood',
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
}
