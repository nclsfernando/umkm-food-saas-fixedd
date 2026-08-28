import { NextResponse } from 'next/server';
import { getPrisma, hasDatabaseUrl } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = hasDatabaseUrl();
  let db: 'connected' | 'disconnected' | 'error' = 'disconnected';

  if (configured) {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      db = 'connected';
    } catch {
      db = 'error';
    }
  }

  return NextResponse.json({
    status: 'ok',
    db,
    databaseConfigured: configured,
    timestamp: new Date().toISOString(),
    host: 'vercel',
  });
}
