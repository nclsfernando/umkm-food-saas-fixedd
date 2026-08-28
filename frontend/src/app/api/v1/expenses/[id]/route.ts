import { NextRequest, NextResponse } from 'next/server';
import { findOneExpense, removeExpense, updateExpense } from '@/lib/server/expenses';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await findOneExpense(id));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Biaya tidak ditemukan' }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    return NextResponse.json(await updateExpense(id, body));
  } catch (err: any) {
    const status = err?.message === 'Biaya tidak ditemukan' ? 404 : 400;
    return NextResponse.json({ message: err?.message || 'Gagal update biaya' }, { status });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await removeExpense(id));
  } catch (err: any) {
    const status = err?.message === 'Biaya tidak ditemukan' ? 404 : 400;
    return NextResponse.json({ message: err?.message || 'Gagal hapus biaya' }, { status });
  }
}
