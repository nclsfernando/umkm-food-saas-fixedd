import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    const { items, ...orderData } = dto;
    return this.prisma.order.create({
      data: {
        ...orderData,
        grossSales: orderData.grossSales.toString(),
        discount: (orderData.discount || 0).toString(),
        commission: (orderData.commission || 0).toString(),
        netSales: orderData.netSales.toString(),
        items: items ? {
          create: items.map(i => ({
            productName: i.productName,
            qty: i.qty,
            unitPrice: i.unitPrice.toString(),
            subtotal: i.subtotal.toString(),
          })),
        } : undefined,
      },
      include: { items: true },
    });
  }

  async findAll(opts: { from?: string; to?: string; marketplace?: string; status?: string; page?: number; limit?: number }) {
    const { from, to, marketplace, status, page = 1, limit = 50 } = opts;
    const where: any = {};
    if (from && to) where.orderDate = { gte: new Date(from), lte: new Date(to) };
    if (marketplace) where.marketplace = marketplace;
    if (status) where.status = status;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({ where, include: { items: true }, orderBy: { orderDate: 'desc' }, skip, take: limit }),
      this.prisma.order.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findOne(id: string) {
    return this.prisma.order.findUniqueOrThrow({ where: { id }, include: { items: true, settlement: true } });
  }

  async importCsv(rows: any[]) {
    let created = 0, skipped = 0;
    for (const row of rows) {
      try {
        await this.create(row);
        created++;
      } catch { skipped++; }
    }
    return { created, skipped };
  }
}
