import { prisma } from '@/lib/db';
import { parseDayEnd, parseDayStart } from '@/lib/period';
import { calculateHpp } from '@/lib/server/hpp';

export async function profitLoss(from: string, to: string) {
  const dateFilter = { gte: parseDayStart(from), lte: parseDayEnd(to) };
  const [orderAgg, expenses, hpp] = await Promise.all([
    prisma.order.aggregate({
      where: { status: 'COMPLETED', orderDate: dateFilter },
      _sum: { grossSales: true, discount: true, commission: true, netSales: true },
      _count: { id: true },
    }),
    prisma.expense.findMany({
      where: { expenseDate: dateFilter },
      select: { category: true, amount: true },
    }),
    calculateHpp(dateFilter.gte, dateFilter.lte),
  ]);

  const grossSales = Number(orderAgg._sum.grossSales ?? 0);
  const discount = Number(orderAgg._sum.discount ?? 0);
  const commission = Number(orderAgg._sum.commission ?? 0);
  const netSales = Number(orderAgg._sum.netSales ?? 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const grossProfit = netSales - hpp;
  const netProfit = grossProfit - totalExpenses;

  const expenseByCategory: Record<string, number> = {};
  for (const e of expenses) {
    expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + Number(e.amount);
  }

  return {
    period: { from, to },
    orders: orderAgg._count.id,
    revenue: { grossSales, discount, commission, netSales },
    cogs: { hpp },
    grossProfit,
    operatingExpenses: { total: totalExpenses, byCategory: expenseByCategory },
    netProfit,
  };
}

export async function marketplaceSummary(from: string, to: string) {
  return prisma.order.groupBy({
    by: ['marketplace'],
    where: {
      status: 'COMPLETED',
      orderDate: { gte: parseDayStart(from), lte: parseDayEnd(to) },
    },
    _count: { id: true },
    _sum: { grossSales: true, commission: true, netSales: true },
  });
}
