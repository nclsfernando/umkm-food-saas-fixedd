import { prisma } from '@/lib/db';
import { parseDayEnd, parseDayStart } from '@/lib/period';
import { toLocalDateString } from '@/lib/utils';
import { calculateHpp } from '@/lib/server/hpp';

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

function buildPeriod(agg: Awaited<ReturnType<typeof aggregateOrders>>) {
  return {
    orders: agg.count,
    grossSales: agg.grossSales,
    discount: agg.discount,
    commission: agg.commission,
    netSales: agg.netSales,
  };
}

/**
 * Dashboard summary.
 * Optional `from`/`to` (YYYY-MM-DD) scopes the main KPI block.
 * Default without params: start of year → today (same as shared FE period).
 */
export async function getSummary(fromStr?: string, toStr?: string) {
  const today = startOfDay();
  const todayEnd = endOfDay();
  const weekStart = startOfDay(new Date(Date.now() - 6 * 86400000));

  const ytdFrom = startOfDay(new Date(new Date().getFullYear(), 0, 1));
  const periodFrom = fromStr ? parseDayStart(fromStr) : ytdFrom;
  const periodTo = toStr ? parseDayEnd(toStr) : todayEnd;
  const periodFromLabel = fromStr ?? toLocalDateString(periodFrom);
  const periodToLabel = toStr ?? toLocalDateString(today);

  const [todayOrders, weekOrders, periodOrders, periodExpenses, periodHpp, pendingSettlement] =
    await Promise.all([
      aggregateOrders(today, todayEnd),
      aggregateOrders(weekStart, todayEnd),
      aggregateOrders(periodFrom, periodTo),
      aggregateExpenses(periodFrom, periodTo),
      calculateHpp(periodFrom, periodTo),
      prisma.settlement.aggregate({ where: { status: 'PENDING' }, _sum: { expectedAmount: true } }),
    ]);

  const periodBlock = {
    from: periodFromLabel,
    to: periodToLabel,
    ...buildPeriod(periodOrders),
    hpp: periodHpp,
    expenses: periodExpenses,
    grossProfit: periodOrders.netSales - periodHpp,
    netProfit: periodOrders.netSales - periodHpp - periodExpenses,
  };

  return {
    today: { omzet: periodOrders.grossSales, ...buildPeriod(todayOrders) },
    week: buildPeriod(weekOrders),
    period: periodBlock,
    /** Alias for older clients that read `month` as the main KPI block. */
    month: periodBlock,
    pendingSettlement: pendingSettlement._sum.expectedAmount ?? 0,
  };
}

export async function getMarketplaceBreakdown(from: string, to: string) {
  const results = await prisma.order.groupBy({
    by: ['marketplace'],
    where: {
      status: 'COMPLETED',
      orderDate: { gte: parseDayStart(from), lte: parseDayEnd(to) },
    },
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
    where: {
      order: {
        status: 'COMPLETED',
        orderDate: { gte: parseDayStart(from), lte: parseDayEnd(to) },
      },
    },
    _sum: { qty: true, subtotal: true },
    orderBy: { _sum: { qty: 'desc' } },
    take: limit,
  });
}

function pivotByMarketplace(rows: any[], dateKey: string) {
  const map: Record<string, any> = {};
  const mpKeys = ['GRABFOOD', 'GOFOOD', 'SHOPEEFOOD'];
  const mpLabel: Record<string, string> = {
    GRABFOOD: 'GrabFood',
    GOFOOD: 'GoFood',
    SHOPEEFOOD: 'ShopeeFood',
  };

  for (const row of rows) {
    const key = String(row[dateKey]);
    if (!map[key]) {
      map[key] = { [dateKey]: key, total: { orders: 0, grossSales: 0, commission: 0, netSales: 0 } };
      for (const mp of mpKeys) map[key][mpLabel[mp]] = { orders: 0, grossSales: 0, commission: 0, netSales: 0 };
    }
    const mpRaw = String(row.marketplace || '').toUpperCase();
    const label = mpLabel[mpRaw];
    if (label && map[key][label]) {
      map[key][label].orders += row.orders;
      map[key][label].grossSales += row.gross_sales;
      map[key][label].commission += row.commission;
      map[key][label].netSales += row.net_sales;
    }
    map[key].total.orders += row.orders;
    map[key].total.grossSales += row.gross_sales;
    map[key].total.commission += row.commission;
    map[key].total.netSales += row.net_sales;
  }
  return Object.values(map);
}

export async function getReportByDate(from: string, to: string) {
  const fromDate = from ? parseDayStart(from) : new Date('2000-01-01');
  const toDate = to ? parseDayEnd(to) : new Date('2099-12-31');
  const rows = await prisma.$queryRaw<any[]>`
    SELECT 
      DATE("orderDate") as tanggal,
      marketplace,
      COUNT(id)::int as orders,
      SUM("grossSales")::float as gross_sales,
      SUM(commission)::float as commission,
      SUM("netSales")::float as net_sales
    FROM "Order"
    WHERE status = 'COMPLETED' AND "orderDate" >= ${fromDate} AND "orderDate" <= ${toDate}
    GROUP BY DATE("orderDate"), marketplace
    ORDER BY tanggal DESC, marketplace ASC`;
  return pivotByMarketplace(rows, 'tanggal');
}

export async function getReportByMonth(year: number) {
  const from = new Date(`${year}-01-01`);
  const to = new Date(`${year}-12-31T23:59:59`);
  const rows = await prisma.$queryRaw<any[]>`
    SELECT 
      TO_CHAR("orderDate", 'YYYY-MM') as bulan,
      marketplace,
      COUNT(id)::int as orders,
      SUM("grossSales")::float as gross_sales,
      SUM(commission)::float as commission,
      SUM("netSales")::float as net_sales
    FROM "Order"
    WHERE status = 'COMPLETED' AND "orderDate" >= ${from} AND "orderDate" <= ${to}
    GROUP BY TO_CHAR("orderDate", 'YYYY-MM'), marketplace
    ORDER BY bulan DESC, marketplace ASC`;
  return pivotByMarketplace(rows, 'bulan');
}
