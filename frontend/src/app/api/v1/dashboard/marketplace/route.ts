import { NextRequest, NextResponse } from 'next/server';
import { getMarketplaceBreakdown } from '@/lib/server/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get('from') || '';
    const to = req.nextUrl.searchParams.get('to') || '';
    return NextResponse.json(await getMarketplaceBreakdown(from, to));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal memuat marketplace' }, { status: 500 });
  }
}
