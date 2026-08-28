import { prisma } from '@/lib/db';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function aggregateOrders(from: Date, to: Date) {
  const agg = await prisma.order.aggregate({
    where: { status: 'COMPLETED', orderDate: { gte: from, lte: to } },
    _count: { id: true },
    _sum: { grossSales: true, discount: true, commission: true, netSales: true },
  });
  return {
    count: agg._count.id,
    grossSales: Number(agg._sum.grossSales ?? 0),
    discount: Number(agg._sum.discount ?? 0),
    commission: Number(agg._sum.commission ?? 0),
    netSales: Number(agg._sum.netSales ?? 0),
  };
}

async function aggregateExpenses(from: Date, to: Date) {
  const agg = await prisma.expense.aggregate({
    where: { expenseDate: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

async function calculateHpp(from: Date, to: Date) {
  const items = await prisma.orderItem.findMany({
    where: { order: { status: 'COMPLETED', orderDate: { gte: from, lte: to } } },
    select: { unitPrice: true, qty: true },
  });
  return items.reduce((acc, i) => acc + Number(i.unitPrice) * i.qty, 0);
}

function buildPeriod(agg: Awaited<ReturnType<typeof aggregateOrders>>) {
  return {
    orders: agg.count,
    grossSales: agg.grossSales,
    discount: agg.discount,
    commission: agg.commission,
    netSales: agg.netSales,
  };
}

export async function getSummary() {
  const today = startOfDay();
  const todayEnd = endOfDay();
  const weekStart = startOfDay(new Date(Date.now() - 6 * 86400000));
  const monthStart = startOfDay(new Date(Date.now() - 29 * 86400000));

  const [todayOrders, weekOrders, monthOrders, monthExpenses, pendingSettlement] = await Promise.all([
    aggregateOrders(today, todayEnd),
    aggregateOrders(weekStart, todayEnd),
    aggregateOrders(monthStart, todayEnd),
    aggregateExpenses(monthStart, todayEnd),
    prisma.settlement.aggregate({ where: { status: 'PENDING' }, _sum: { expectedAmount: true } }),
  ]);
  const monthHpp = await calculateHpp(monthStart, todayEnd);

  return {
    today: { omzet: monthOrders.grossSales, ...buildPeriod(todayOrders) },
    week: buildPeriod(weekOrders),
    month: {
      ...buildPeriod(monthOrders),
      hpp: monthHpp,
      expenses: monthExpenses,
      grossProfit: monthOrders.netSales - monthHpp,
      netProfit: monthOrders.netSales - monthHpp - monthExpenses,
    },
    pendingSettlement: pendingSettlement._sum.expectedAmount ?? 0,
  };
}

export async function getMarketplaceBreakdown(from: string, to: string) {
  const results = await prisma.order.groupBy({
    by: ['marketplace'],
    where: { status: 'COMPLETED', orderDate: { gte: new Date(from), lte: new Date(to) } },
    _count: { id: true },
    _sum: { grossSales: true, commission: true, netSales: true },
  });
  return results.map((r) => ({
    marketplace: r.marketplace,
    orders: r._count.id,
    grossSales: r._sum.grossSales ?? 0,
    commission: r._sum.commission ?? 0,
    netSales: r._sum.netSales ?? 0,
  }));
}

export async function getDailyChart(year: number, month: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return prisma.$queryRaw<any[]>`
    SELECT DATE("orderDate") as day,
      SUM("grossSales")::float as gross_sales,
      SUM("netSales")::float as net_sales,
      COUNT(id) as orders
    FROM "Order"
    WHERE status = 'COMPLETED' AND "orderDate" >= ${from} AND "orderDate" <= ${to}
    GROUP BY DATE("orderDate") ORDER BY day ASC`;
}

export async function getTopProducts(from: string, to: string, limit = 10) {
  return prisma.orderItem.groupBy({
    by: ['productName'],
    where: { order: { status: 'COMPLETED', orderDate: { gte: new Date(from), lte: new Date(to) } } },
    _sum: { qty: true, subtotal: true },
    orderBy: { _sum: { qty: 'desc' } },
    take: limit,
  });
}
