import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async profitLoss(from: string, to: string) {
    const dateFilter = { gte: new Date(from), lte: new Date(to) };
    const [orderAgg, expenses, items] = await Promise.all([
      this.prisma.order.aggregate({
        where: { status: 'COMPLETED', orderDate: dateFilter },
        _sum: { grossSales: true, discount: true, commission: true, netSales: true },
        _count: { id: true },
      }),
      this.prisma.expense.findMany({ where: { expenseDate: dateFilter }, select: { category: true, amount: true } }),
      this.prisma.orderItem.findMany({
        where: { order: { status: 'COMPLETED', orderDate: dateFilter } },
        include: { product: { select: { hpp: true } } },
      }),
    ]);

    const grossSales = new Decimal(orderAgg._sum.grossSales ?? 0);
    const discount = new Decimal(orderAgg._sum.discount ?? 0);
    const commission = new Decimal(orderAgg._sum.commission ?? 0);
    const netSales = new Decimal(orderAgg._sum.netSales ?? 0);
    const hpp = items.reduce((acc, i) => acc.plus(i.product ? new Decimal(i.product.hpp).times(i.qty) : 0), new Decimal(0));
    const totalExpenses = expenses.reduce((acc, e) => acc.plus(e.amount), new Decimal(0));
    const grossProfit = netSales.minus(hpp);
    const netProfit = grossProfit.minus(totalExpenses);

    const expenseByCategory: Record<string, number> = {};
    for (const e of expenses) {
      expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + Number(e.amount);
    }

    return {
      period: { from, to },
      orders: orderAgg._count.id,
      revenue: {
        grossSales: grossSales.toNumber(),
        discount: discount.toNumber(),
        commission: commission.toNumber(),
        netSales: netSales.toNumber(),
      },
      cogs: { hpp: hpp.toNumber() },
      grossProfit: grossProfit.toNumber(),
      operatingExpenses: { total: totalExpenses.toNumber(), byCategory: expenseByCategory },
      netProfit: netProfit.toNumber(),
    };
  }

  async marketplaceSummary(from: string, to: string) {
    return this.prisma.order.groupBy({
      by: ['marketplace'],
      where: { status: 'COMPLETED', orderDate: { gte: new Date(from), lte: new Date(to) } },
      _count: { id: true },
      _sum: { grossSales: true, commission: true, netSales: true },
    });
  }
}
