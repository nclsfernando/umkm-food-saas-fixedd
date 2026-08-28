import { NextRequest, NextResponse } from 'next/server';
import { createOrder, findAllOrders } from '@/lib/server/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();
    return NextResponse.json(await createOrder(body));
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || 'Gagal membuat order' }, { status: 400 });
  }
}
