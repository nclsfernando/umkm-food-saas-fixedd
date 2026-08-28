import { prisma } from '@/lib/db';

export async function profitLoss(from: string, to: string) {
  const dateFilter = { gte: new Date(from), lte: new Date(to) };
  const [orderAgg, expenses, items] = await Promise.all([
    prisma.order.aggregate({
      where: { status: 'COMPLETED', orderDate: dateFilter },
      _sum: { grossSales: true, discount: true, commission: true, netSales: true },
      _count: { id: true },
    }),
    prisma.expense.findMany({
      where: { expenseDate: dateFilter },
      select: { category: true, amount: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { status: 'COMPLETED', orderDate: dateFilter } },
      select: { unitPrice: true, qty: true },
    }),
  ]);

  const grossSales = Number(orderAgg._sum.grossSales ?? 0);
  const discount = Number(orderAgg._sum.discount ?? 0);
  const commission = Number(orderAgg._sum.commission ?? 0);
  const netSales = Number(orderAgg._sum.netSales ?? 0);
  const hpp = items.reduce((acc, i) => acc + Number(i.unitPrice) * i.qty, 0);
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
    where: { status: 'COMPLETED', orderDate: { gte: new Date(from), lte: new Date(to) } },
    _count: { id: true },
    _sum: { grossSales: true, commission: true, netSales: true },
  });
}
