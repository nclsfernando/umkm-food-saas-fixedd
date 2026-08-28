import { NextRequest, NextResponse } from 'next/server';
import { importProducts } from '@/lib/server/products';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: 'File tidak ditemukan' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importProducts(buffer, file.name || 'upload.xlsx');
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal import produk' }, { status: 400 });
  }
}
