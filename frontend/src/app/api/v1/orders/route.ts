import { NextRequest, NextResponse } from 'next/server';
import { createOrder, findAllOrders } from '@/lib/server/orders';
import { requireDatabaseOr503 } from '@/lib/server/db-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const sp = req.nextUrl.searchParams;
    const data = await findAllOrders({
      from: sp.get('from') || undefined,
      to: sp.get('to') || undefined,
      marketplace: sp.get('marketplace') || undefined,
      status: sp.get('status') || undefined,
      page: Number(sp.get('page') || 1),
      limit: Number(sp.get('limit') || 50),
    });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal memuat orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = requireDatabaseOr503();
  if (blocked) return blocked;
  try {
    const body = await req.json();
    return NextResponse.json(await createOrder(body));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal membuat order' }, { status: 400 });
  }
}
