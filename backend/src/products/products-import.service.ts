import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

@Injectable()
export class ProductsImportService {
  constructor(private prisma: PrismaService) {}

  async importFile(buffer: Buffer, filename: string): Promise<ImportResult> {
    const ext = filename.split('.').pop()?.toLowerCase();
    let rows: any[] = [];

    if (ext === 'csv') {
      rows = this.parseCsv(buffer.toString('utf-8'));
    } else if (ext === 'xlsx' || ext === 'xls') {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new BadRequestException('Sheet pertama tidak ditemukan di file.');
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } else {
      throw new BadRequestException('Format file tidak didukung. Gunakan CSV atau XLSX.');
    }

    if (rows.length === 0) throw new BadRequestException('Tidak ada data produk yang ditemukan di file.');
    return this.bulkUpsert(rows);
  }

  private async bulkUpsert(rows: any[]): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 for header, +1 for 1-index

      try {
        const name = this.pick(row, ['Nama Produk', 'Nama', 'name']);
        const categoryName = this.pick(row, ['Kategori', 'category']);
        const sellingPrice = this.parsePrice(this.pick(row, ['Harga (Rp)', 'Harga Jual', 'Harga', 'sellingPrice', 'price']));
        const hppRaw = this.pick(row, ['HPP', 'Harga Modal', 'hpp']);
        const hpp = hppRaw ? this.parsePrice(hppRaw) : 0;

        if (!name || !categoryName || !sellingPrice) {
          result.skipped++;
          result.errors.push(`Baris ${rowNum}: data tidak lengkap (nama/kategori/harga kosong)`);
          continue;
        }

        const category = await this.prisma.category.upsert({
          where: { name: categoryName },
          update: {},
          create: { name: categoryName },
        });

        const existing = await this.prisma.product.findFirst({
          where: { name, categoryId: category.id },
        });

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data: { sellingPrice: sellingPrice.toString(), isActive: true },
          });
          result.updated++;
        } else {
          await this.prisma.product.create({
            data: {
              name,
              categoryId: category.id,
              sellingPrice: sellingPrice.toString(),
              hpp: hpp.toString(),
            },
          });
          result.created++;
        }
      } catch (e: any) {
        result.skipped++;
        result.errors.push(`Baris ${rowNum}: ${e.message || 'gagal diproses'}`);
      }
    }

    return result;
  }

  private pick(row: any, keys: string[]): string {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
    }
    return '';
  }

  private parsePrice(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val)
      .replace(/Rp/gi, '')
      .replace(/[^0-9.,-]/g, '')
      .trim();
    if (!cleaned) return 0;
    // Handle "15.000" (ID thousands) vs "15000.50" (decimal)
    const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/\.(?=\d{3}(\D|$))/g, '');
    return parseFloat(normalized) || 0;
  }

  private parseCsv(text: string): any[] {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((h, idx) => (row[h] = cols[idx] || ''));
      rows.push(row);
    }
    return rows;
  }
}
