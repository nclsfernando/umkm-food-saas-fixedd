import { NextResponse } from 'next/server';
import { getSummary } from '@/lib/server/dashboard';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    return NextResponse.json(await getSummary());
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal memuat summary' }, { status: 500 });
  }
}
