import { NextResponse } from 'next/server';
import { cleanDuplicates } from '@/lib/server/import-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    return NextResponse.json(await cleanDuplicates());
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal membersihkan duplikat' }, { status: 500 });
  }
}
