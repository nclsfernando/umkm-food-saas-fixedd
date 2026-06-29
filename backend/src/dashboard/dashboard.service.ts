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

  async getReportByDate(from: string, to: string) {
    const fromDate = from ? new Date(from) : new Date('2000-01-01');
    const toDate = to ? new Date(to) : new Date('2099-12-31');
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT 
        DATE(order_date) as tanggal,
        marketplace,
        COUNT(id)::int as orders,
        SUM(gross_sales)::float as gross_sales,
        SUM(commission)::float as commission,
        SUM(net_sales)::float as net_sales
      FROM orders
      WHERE status = 'COMPLETED' AND order_date >= ${fromDate} AND order_date <= ${toDate}
      GROUP BY DATE(order_date), marketplace
      ORDER BY tanggal DESC, marketplace ASC`;
    return this.pivotByMarketplace(rows, 'tanggal');
  }

  async getReportByMonth(year: number) {
    const from = new Date(`${year}-01-01`);
    const to = new Date(`${year}-12-31T23:59:59`);
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT 
        TO_CHAR(order_date, 'YYYY-MM') as bulan,
        marketplace,
        COUNT(id)::int as orders,
        SUM(gross_sales)::float as gross_sales,
        SUM(commission)::float as commission,
        SUM(net_sales)::float as net_sales
      FROM orders
      WHERE status = 'COMPLETED' AND order_date >= ${from} AND order_date <= ${to}
      GROUP BY TO_CHAR(order_date, 'YYYY-MM'), marketplace
      ORDER BY bulan DESC, marketplace ASC`;
    return this.pivotByMarketplace(rows, 'bulan');
  }

  private pivotByMarketplace(rows: any[], dateKey: string) {
    const map: Record<string, any> = {};
    const marketplaces = ['GrabFood', 'GoFood', 'ShopeeFood'];

    for (const row of rows) {
      const key = row[dateKey];
      if (!map[key]) {
        map[key] = { [dateKey]: key, total: { orders: 0, grossSales: 0, commission: 0, netSales: 0 } };
        for (const mp of marketplaces) map[key][mp] = { orders: 0, grossSales: 0, commission: 0, netSales: 0 };
      }
      const mp = row.marketplace;
      if (map[key][mp]) {
        map[key][mp].orders += row.orders;
        map[key][mp].grossSales += row.gross_sales;
        map[key][mp].commission += row.commission;
        map[key][mp].netSales += row.net_sales;
      }
      map[key].total.orders += row.orders;
      map[key].total.grossSales += row.gross_sales;
      map[key].total.commission += row.commission;
      map[key].total.netSales += row.net_sales;
    }
    return Object.values(map);
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
      select: { unitPrice: true, qty: true },
    });
    return items.reduce((acc, i) => acc + Number(i.unitPrice) * i.qty, 0);
  }

  private buildPeriod(agg: any) {
    return { orders: agg.count, grossSales: agg.grossSales, discount: agg.discount, commission: agg.commission, netSales: agg.netSales };
  }
}
