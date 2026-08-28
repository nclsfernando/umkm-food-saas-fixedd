import { NextRequest, NextResponse } from 'next/server';
import { marketplaceSummary } from '@/lib/server/reports';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const from = req.nextUrl.searchParams.get('from') || '';
    const to = req.nextUrl.searchParams.get('to') || '';
    if (!from || !to) {
      return NextResponse.json({ message: 'Parameter from dan to wajib diisi' }, { status: 400 });
    }
    return NextResponse.json(await marketplaceSummary(from, to));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal memuat laporan marketplace' }, { status: 500 });
  }
}
