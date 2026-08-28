import { NextRequest, NextResponse } from 'next/server';
import { getReportByDate } from '@/lib/server/dashboard';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const from = req.nextUrl.searchParams.get('from') || '';
    const to = req.nextUrl.searchParams.get('to') || '';
    return NextResponse.json(await getReportByDate(from, to));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal memuat laporan harian' }, { status: 500 });
  }
}
