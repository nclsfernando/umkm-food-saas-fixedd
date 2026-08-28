import { NextResponse } from 'next/server';
import { deleteAllOrders } from '@/lib/server/import-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    return NextResponse.json(await deleteAllOrders());
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal menghapus data' }, { status: 500 });
  }
}
