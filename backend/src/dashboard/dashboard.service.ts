import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as dayjs from 'dayjs';
import Decimal from 'decimal.js';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const today = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();
    const weekStart = dayjs().startOf('week').toDate();
    const monthStart = dayjs().startOf('month').toDate();
    const monthEnd = dayjs().endOf('month').toDate();

    const [todayOrders, weekOrders, monthOrders, monthExpenses, pendingSettlement] = await Promise.all([
      this.aggregateOrders(today, todayEnd),
      this.aggregateOrders(weekStart, todayEnd),
      this.aggregateOrders(monthStart, monthEnd),
      this.aggregateExpenses(monthStart, monthEnd),
      this.prisma.settlement.aggregate({ where: { status: 'PENDING' }, _sum: { expectedAmount: true } }),
    ]);

    const monthHpp = await this.calculateHpp(monthStart, monthEnd);

    return {
      today: { omzet: monthOrders.grossSales, ...this.buildPeriod(todayOrders) },
      week: this.buildPeriod(weekOrders),
      month: {
        ...this.buildPeriod(monthOrders),
        hpp: monthHpp,
        expenses: monthExpenses,
        grossProfit: new Decimal(monthOrders.netSales).minus(monthHpp).toNumber(),
        netProfit: new Decimal(monthOrders.netSales).minus(monthHpp).minus(monthExpenses).toNumber(),
      },
      pendingSettlement: pendingSettlement._sum.expectedAmount ?? 0,
    };
  }

  async getMarketplaceBreakdown(from: string, to: string) {
    const results = await this.prisma.order.groupBy({
      by: ['marketplace'],
      where: { status: 'COMPLETED', orderDate: { gte: new Date(from), lte: new Date(to) } },
      _count: { id: true },
      _sum: { grossSales: true, commission: true, netSales: true },
    });
    return results.map(r => ({
      marketplace: r.marketplace,
      orders: r._count.id,
      grossSales: r._sum.grossSales ?? 0,
      commission: r._sum.commission ?? 0,
      netSales: r._sum.netSales ?? 0,
    }));
  }

  async getDailyChart(year: number, month: number) {
    const from = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const to = dayjs(`${year}-${month}-01`).endOf('month').toDate();
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT DATE(order_date) as day,
        SUM(gross_sales)::float as gross_sales,
        SUM(net_sales)::float as net_sales,
        COUNT(id) as orders
      FROM orders
      WHERE status = 'COMPLETED' AND order_date >= ${from} AND order_date <= ${to}
      GROUP BY DATE(order_date) ORDER BY day ASC`;
    return rows;
  }

  async getTopProducts(from: string, to: string, limit = 10) {
    return this.prisma.orderItem.groupBy({
      by: ['productName'],
      where: { order: { status: 'COMPLETED', orderDate: { gte: new Date(from), lte: new Date(to) } } },
      _sum: { qty: true, subtotal: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: limit,
    });
  }

  private async aggregateOrders(from: Date, to: Date) {
    const agg = await this.prisma.order.aggregate({
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

  private async aggregateExpenses(from: Date, to: Date) {
    const agg = await this.prisma.expense.aggregate({
      where: { expenseDate: { gte: from, lte: to } },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  private async calculateHpp(from: Date, to: Date) {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { status: 'COMPLETED', orderDate: { gte: from, lte: to } } },
      include: { product: { select: { hpp: true } } },
    });
    return items.reduce((acc, i) => acc + (i.product ? Number(i.product.hpp) * i.qty : 0), 0);
  }

  private buildPeriod(agg: any) {
    return { orders: agg.count, grossSales: agg.grossSales, discount: agg.discount, commission: agg.commission, netSales: agg.netSales };
  }
}
