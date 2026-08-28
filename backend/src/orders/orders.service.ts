import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateOrderDto | Record<string, any>) {
    const { items, marketplace, orderDate, grossSales, discount, commission, netSales, status } = dto as any;
    return this.prisma.order.create({
      data: {
        marketplace,
        orderDate: orderDate ? new Date(orderDate) : undefined,
        grossSales: Number(grossSales).toString(),
        discount: Number(discount || 0).toString(),
        commission: Number(commission || 0).toString(),
        netSales: Number(netSales).toString(),
        status: status || undefined,
        items: items ? {
          create: items.map((i: any) => ({
            productName: i.productName,
            qty: i.qty,
            unitPrice: Number(i.unitPrice).toString(),
            subtotal: Number(i.subtotal).toString(),
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
    const errors: string[] = [];
    for (const row of rows) {
      try {
        const isDup = await this.isDuplicate(row);
        if (isDup) { skipped++; continue; }
        await this.create(row);
        created++;
      } catch (err: any) {
        skipped++;
        const msg = err?.message || String(err);
        this.logger.warn(`Import row skipped: ${msg}`);
        if (errors.length < 5) errors.push(msg);
      }
    }
    if (created === 0 && skipped > 0 && errors.length > 0) {
      this.logger.error(`Import selesai tanpa create. Contoh error: ${errors.join(' | ')}`);
    }
    return { created, skipped, ...(errors.length ? { errors } : {}) };
  }

  private async isDuplicate(row: any): Promise<boolean> {
    const orderDate = new Date(row.orderDate);
    const dayStart = new Date(orderDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(orderDate); dayEnd.setHours(23, 59, 59, 999);

    let idPesanan = '';
    try {
      const meta = JSON.parse(row.items?.[0]?.productName || '{}');
      idPesanan = meta.idPesanan || '';
    } catch { /* format lama, skip id check */ }

    // Rekap Summary: unik per toko + bulan (atau hari), meskipun nominal beda
    if (idPesanan.startsWith('GRABFOOD-SUMMARY-')) {
      const monthStart = new Date(orderDate.getFullYear(), orderDate.getMonth(), 1);
      const monthEnd = new Date(orderDate.getFullYear(), orderDate.getMonth() + 1, 0, 23, 59, 59, 999);
      const candidates = await this.prisma.order.findMany({
        where: {
          marketplace: row.marketplace,
          orderDate: { gte: monthStart, lte: monthEnd },
        },
        include: { items: true },
      });
      return candidates.some(o => {
        try {
          return JSON.parse(o.items?.[0]?.productName || '{}').idPesanan === idPesanan;
        } catch {
          return false;
        }
      });
    }

    const existing = await this.prisma.order.findFirst({
      where: {
        marketplace: row.marketplace,
        orderDate: { gte: dayStart, lte: dayEnd },
        grossSales: Number(row.grossSales).toString(),
      },
      include: { items: true },
    });

    if (!existing) return false;

    if (idPesanan) {
      try {
        const existingMeta = JSON.parse(existing.items?.[0]?.productName || '{}');
        return existingMeta.idPesanan === idPesanan;
      } catch {
        return true;
      }
    }
    return true;
  }
}
