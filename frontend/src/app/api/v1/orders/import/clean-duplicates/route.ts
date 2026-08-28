import { NextResponse } from 'next/server';
import { cleanDuplicates } from '@/lib/server/import-service';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    return NextResponse.json(await cleanDuplicates());
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal membersihkan duplikat' }, { status: 500 });
  }
}
