import { prisma } from '@/lib/db';

export async function createOrder(dto: Record<string, any>) {
  const { items, marketplace, orderDate, grossSales, discount, commission, netSales, status } = dto;
  return prisma.order.create({
    data: {
      marketplace,
      orderDate: orderDate ? new Date(orderDate) : undefined,
      grossSales: Number(grossSales).toString(),
      discount: Number(discount || 0).toString(),
      commission: Number(commission || 0).toString(),
      netSales: Number(netSales).toString(),
      status: status || undefined,
      items: items
        ? {
            create: items.map((i: any) => ({
              productName: i.productName,
              qty: i.qty,
              unitPrice: Number(i.unitPrice).toString(),
              subtotal: Number(i.subtotal).toString(),
            })),
          }
        : undefined,
    },
    include: { items: true },
  });
}

export async function findAllOrders(opts: {
  from?: string;
  to?: string;
  marketplace?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const { from, to, marketplace, status, page = 1, limit = 50 } = opts;
  const where: any = {};
  if (from && to) where.orderDate = { gte: new Date(from), lte: new Date(to) };
  if (marketplace) where.marketplace = marketplace;
  if (status) where.status = status;
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { orderDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function findOneOrder(id: string) {
  return prisma.order.findUniqueOrThrow({
    where: { id },
    include: { items: true, settlement: true },
  });
}

function rowIdPesanan(row: { items?: { productName?: string }[] }): string {
  try {
    const meta = JSON.parse(row.items?.[0]?.productName || '{}');
    return meta.idPesanan || '';
  } catch {
    return '';
  }
}

/** In-memory dedup key — mirrors legacy isDuplicate without N+1 queries. */
function rowDedupKey(row: any): string {
  const orderDate = new Date(row.orderDate);
  const idPesanan = rowIdPesanan(row);
  if (idPesanan.startsWith('GRABFOOD-SUMMARY-')) {
    return `summary|${row.marketplace}|${orderDate.getFullYear()}-${orderDate.getMonth()}|${idPesanan}`;
  }
  const dateKey = orderDate.toISOString().split('T')[0];
  return `order|${row.marketplace}|${dateKey}|${Number(row.grossSales)}|${idPesanan}`;
}

export async function importCsvRows(rows: any[]) {
  if (!rows.length) return { created: 0, skipped: 0 };

  const times = rows.map((r) => new Date(r.orderDate).getTime()).filter((t) => !Number.isNaN(t));
  const rangeStart = new Date(Math.min(...times));
  rangeStart.setDate(1);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(Math.max(...times));
  rangeEnd.setMonth(rangeEnd.getMonth() + 1, 0);
  rangeEnd.setHours(23, 59, 59, 999);

  const existing = await prisma.order.findMany({
    where: { orderDate: { gte: rangeStart, lte: rangeEnd } },
    select: {
      marketplace: true,
      orderDate: true,
      grossSales: true,
      items: { select: { productName: true } },
    },
  });

  const seen = new Set(existing.map((o) => rowDedupKey(o)));
  const toInsert: any[] = [];
  let skipped = 0;

  for (const row of rows) {
    const key = rowDedupKey(row);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    toInsert.push(row);
  }

  const BATCH = 25;
  let created = 0;
  const errors: string[] = [];

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    try {
      await prisma.$transaction(
        batch.map((row) => {
          const { items, marketplace, orderDate, grossSales, discount, commission, netSales, status } = row;
          return prisma.order.create({
            data: {
              marketplace,
              orderDate: new Date(orderDate),
              grossSales: Number(grossSales).toString(),
              discount: Number(discount || 0).toString(),
              commission: Number(commission || 0).toString(),
              netSales: Number(netSales).toString(),
              status: status || 'COMPLETED',
              items: items
                ? {
                    create: items.map((item: any) => ({
                      productName: item.productName,
                      qty: item.qty,
                      unitPrice: Number(item.unitPrice).toString(),
                      subtotal: Number(item.subtotal).toString(),
                    })),
                  }
                : undefined,
            },
          });
        }),
      );
      created += batch.length;
    } catch (err: any) {
      skipped += batch.length;
      const msg = err?.message || String(err);
      if (errors.length < 5) errors.push(msg);
    }
  }

  return { created, skipped, ...(errors.length ? { errors } : {}) };
}
