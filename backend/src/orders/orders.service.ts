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
        const isDup = await this.isDuplicate(row);
        if (isDup) { skipped++; continue; }
        await this.create(row);
        created++;
      } catch { skipped++; }
    }
    return { created, skipped };
  }

  private async isDuplicate(row: any): Promise<boolean> {
    // Cek apakah sudah ada order dengan marketplace + tanggal (hari yang sama) + grossSales + idPesanan yang sama
    const orderDate = new Date(row.orderDate);
    const dayStart = new Date(orderDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(orderDate); dayEnd.setHours(23, 59, 59, 999);

    let idPesanan = '';
    try {
      const meta = JSON.parse(row.items?.[0]?.productName || '{}');
      idPesanan = meta.idPesanan || '';
    } catch { /* format lama, skip id check */ }

    const existing = await this.prisma.order.findFirst({
      where: {
        marketplace: row.marketplace,
        orderDate: { gte: dayStart, lte: dayEnd },
        grossSales: row.grossSales.toString(),
      },
      include: { items: true },
    });

    if (!existing) return false;

    // Kalau ada idPesanan, cocokkan juga supaya tidak false-positive saat 2 transaksi beda tapi gross sama
    if (idPesanan) {
      try {
        const existingMeta = JSON.parse(existing.items?.[0]?.productName || '{}');
        return existingMeta.idPesanan === idPesanan;
      } catch {
        return true; // format lama, anggap duplikat by date+gross
      }
    }
    return true;
  }
}
