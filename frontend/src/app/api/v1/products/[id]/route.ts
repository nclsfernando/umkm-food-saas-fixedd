import { NextRequest, NextResponse } from 'next/server';
import { findOneProduct, removeProduct, updateProduct } from '@/lib/server/products';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await findOneProduct(id));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Produk tidak ditemukan' }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    return NextResponse.json(await updateProduct(id, body));
  } catch (err: any) {
    const status = err?.message === 'Produk tidak ditemukan' ? 404 : 400;
    return NextResponse.json({ message: err?.message || 'Gagal update produk' }, { status });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await removeProduct(id));
  } catch (err: any) {
    const status = err?.message === 'Produk tidak ditemukan' ? 404 : 400;
    return NextResponse.json({ message: err?.message || 'Gagal hapus produk' }, { status });
  }
}
