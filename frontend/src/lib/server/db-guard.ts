import { NextResponse } from 'next/server';
import { hasDatabaseUrl } from '@/lib/db';

export const DB_MISSING_MSG =
  'Database belum dikonfigurasi (DATABASE_URL kosong di Vercel). Set DATABASE_URL ke Postgres publik (mis. Neon free), jalankan npm run db:migrate di folder frontend, lalu Redeploy.';

export function requireDatabaseOr503(): NextResponse | null {
  if (hasDatabaseUrl()) return null;
  return NextResponse.json({ message: DB_MISSING_MSG }, { status: 503 });
}
