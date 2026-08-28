import { NextRequest, NextResponse } from 'next/server';
import { getDailyChart } from '@/lib/server/dashboard';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const year = Number(req.nextUrl.searchParams.get('year') || new Date().getFullYear());
    const month = Number(req.nextUrl.searchParams.get('month') || new Date().getMonth() + 1);
    return NextResponse.json(await getDailyChart(year, month));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal memuat chart' }, { status: 500 });
  }
}
