import { NextRequest, NextResponse } from 'next/server';
import { createExpense, findAllExpenses } from '@/lib/server/expenses';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const sp = req.nextUrl.searchParams;
    const data = await findAllExpenses({
      from: sp.get('from') || undefined,
      to: sp.get('to') || undefined,
      page: Number(sp.get('page') || 1),
      limit: Number(sp.get('limit') || 20),
    });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal memuat biaya' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const body = await req.json();
    if (!body?.category || body?.amount == null || !body?.expenseDate) {
      return NextResponse.json({ message: 'category, amount, dan expenseDate wajib' }, { status: 400 });
    }
    return NextResponse.json(await createExpense(body));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal membuat biaya' }, { status: 400 });
  }
}
