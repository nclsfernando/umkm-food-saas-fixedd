import { NextRequest, NextResponse } from 'next/server';
import { createProduct, findAllProducts } from '@/lib/server/products';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const sp = req.nextUrl.searchParams;
    const page = Number(sp.get('page') || 1);
    const limit = Number(sp.get('limit') || 50);
    return NextResponse.json(await findAllProducts(page, limit));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal memuat produk' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const body = await req.json();
    if (!body?.name || !body?.categoryId || body?.sellingPrice == null || body?.hpp == null) {
      return NextResponse.json({ message: 'name, categoryId, sellingPrice, dan hpp wajib' }, { status: 400 });
    }
    return NextResponse.json(await createProduct(body));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal membuat produk' }, { status: 400 });
  }
}
