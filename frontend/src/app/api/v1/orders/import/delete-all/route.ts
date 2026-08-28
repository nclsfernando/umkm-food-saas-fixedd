import { NextResponse } from 'next/server';
import { deleteAllOrders } from '@/lib/server/import-service';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    return NextResponse.json(await deleteAllOrders());
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal menghapus data' }, { status: 500 });
  }
}
