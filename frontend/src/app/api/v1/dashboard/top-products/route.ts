import { NextRequest, NextResponse } from 'next/server';
import { getTopProducts } from '@/lib/server/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get('from') || '';
    const to = req.nextUrl.searchParams.get('to') || '';
    const limit = Number(req.nextUrl.searchParams.get('limit') || 10);
    return NextResponse.json(await getTopProducts(from, to, limit));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal memuat top products' }, { status: 500 });
  }
}
