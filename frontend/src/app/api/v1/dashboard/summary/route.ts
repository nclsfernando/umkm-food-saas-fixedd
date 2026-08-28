import { NextResponse } from 'next/server';
import { getSummary } from '@/lib/server/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getSummary());
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal memuat summary' }, { status: 500 });
  }
}
