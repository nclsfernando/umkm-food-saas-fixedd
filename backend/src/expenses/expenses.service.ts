import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: { ...dto, userId, amount: dto.amount.toString() },
    });
  }

  async findAll(userId: string, from?: string, to?: string, page = 1, limit = 20) {
    const where: any = { userId };
    if (from && to) where.expenseDate = { gte: new Date(from), lte: new Date(to) };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({ where, orderBy: { expenseDate: 'desc' }, skip, take: limit }),
      this.prisma.expense.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const e = await this.prisma.expense.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Biaya tidak ditemukan');
    return e;
  }

  async update(id: string, dto: UpdateExpenseDto) {
    await this.findOne(id);
    return this.prisma.expense.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.expense.delete({ where: { id } });
  }

  async summary(userId: string, from: string, to: string) {
    const result = await this.prisma.expense.groupBy({
      by: ['category'],
      where: { userId, expenseDate: { gte: new Date(from), lte: new Date(to) } },
      _sum: { amount: true },
    });
    return result.map(r => ({ category: r.category, total: r._sum.amount ?? 0 }));
  }
}
