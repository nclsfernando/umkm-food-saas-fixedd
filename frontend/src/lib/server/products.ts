import { prisma } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function createProduct(dto: {
  name: string;
  categoryId: string;
  sellingPrice: number;
  hpp: number;
}) {
  return prisma.product.create({
    data: {
      name: dto.name,
      categoryId: dto.categoryId,
      sellingPrice: Number(dto.sellingPrice).toString(),
      hpp: Number(dto.hpp).toString(),
    },
    include: { category: true },
  });
}

export async function findAllProducts(page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  return prisma.product.findMany({
    include: { category: true },
    orderBy: { name: 'asc' },
    skip,
    take: limit,
  });
}

export async function findOneProduct(id: string) {
  const p = await prisma.product.findUnique({ where: { id }, include: { category: true } });
  if (!p) throw new Error('Produk tidak ditemukan');
  return p;
}

export async function updateProduct(
  id: string,
  dto: { name?: string; categoryId?: string; sellingPrice?: number; hpp?: number },
) {
  await findOneProduct(id);
  const data: any = { ...dto };
  if (dto.sellingPrice != null) data.sellingPrice = Number(dto.sellingPrice).toString();
  if (dto.hpp != null) data.hpp = Number(dto.hpp).toString();
  return prisma.product.update({ where: { id }, data, include: { category: true } });
}

export async function removeProduct(id: string) {
  await findOneProduct(id);
  return prisma.product.update({ where: { id }, data: { isActive: false } });
}

export async function findAllCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}

export interface ProductImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

function pick(row: any, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  return '';
}

function parsePrice(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val)
    .replace(/Rp/gi, '')
    .replace(/[^0-9.,-]/g, '')
    .trim();
  if (!cleaned) return 0;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned.replace(/\.(?=\d{3}(\D|$))/g, '');
  return parseFloat(normalized) || 0;
}

function parseCsv(text: string): any[] {
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

export async function importProducts(buffer: Buffer, filename: string): Promise<ProductImportResult> {
  const ext = filename.split('.').pop()?.toLowerCase();
  let rows: any[] = [];

  if (ext === 'csv') {
    rows = parseCsv(buffer.toString('utf-8'));
  } else if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('Sheet pertama tidak ditemukan di file.');
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } else {
    throw new Error('Format file tidak didukung. Gunakan CSV atau XLSX.');
  }

  if (rows.length === 0) throw new Error('Tidak ada data produk yang ditemukan di file.');

  const result: ProductImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      const name = pick(row, ['Nama Produk', 'Nama', 'name']);
      const categoryName = pick(row, ['Kategori', 'category']);
      const sellingPrice = parsePrice(pick(row, ['Harga (Rp)', 'Harga Jual', 'Harga', 'sellingPrice', 'price']));
      const hppRaw = pick(row, ['HPP', 'Harga Modal', 'hpp']);
      const hpp = hppRaw ? parsePrice(hppRaw) : 0;

      if (!name || !categoryName || !sellingPrice) {
        result.skipped++;
        result.errors.push(`Baris ${rowNum}: data tidak lengkap (nama/kategori/harga kosong)`);
        continue;
      }

      const category = await prisma.category.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
      });

      const existing = await prisma.product.findFirst({
        where: { name, categoryId: category.id },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { sellingPrice: sellingPrice.toString(), isActive: true },
        });
        result.updated++;
      } else {
        await prisma.product.create({
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
