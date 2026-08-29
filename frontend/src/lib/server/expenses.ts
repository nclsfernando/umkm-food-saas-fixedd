import { prisma } from '@/lib/db';

async function getDefaultUserId() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (user) return user.id;
  const created = await prisma.user.create({
    data: {
      email: 'mama@umkmfood.id',
      passwordHash: 'unused',
      name: 'Mama',
      businessName: 'UMKM Food Mama',
      role: 'OWNER',
    },
  });
  return created.id;
}

export async function createExpense(dto: {
  description?: string;
  category: string;
  amount: number;
  expenseDate: string;
}) {
  const userId = await getDefaultUserId();
  return prisma.expense.create({
    data: {
      userId,
      description: dto.description || '',
      category: dto.category,
      amount: Number(dto.amount).toString(),
      expenseDate: new Date(dto.expenseDate),
    },
  });
}

export async function findAllExpenses(opts: {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const { from, to, page = 1, limit = 20 } = opts;
  const where: any = {};
  if (from && to) where.expenseDate = { gte: new Date(from), lte: new Date(to) };
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { expenseDate: 'desc' }, skip, take: limit }),
    prisma.expense.count({ where }),
  ]);
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function findOneExpense(id: string) {
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e) throw new Error('Biaya tidak ditemukan');
  return e;
}

export async function updateExpense(
  id: string,
  dto: { description?: string; category?: string; amount?: number; expenseDate?: string },
) {
  await findOneExpense(id);
  const data: any = { ...dto };
  if (dto.amount != null) data.amount = Number(dto.amount).toString();
  if (dto.expenseDate) data.expenseDate = new Date(dto.expenseDate);
  return prisma.expense.update({ where: { id }, data });
}

export async function removeExpense(id: string) {
  await findOneExpense(id);
  return prisma.expense.delete({ where: { id } });
}

export async function expenseSummary(from: string, to: string) {
  const { parseDayEnd, parseDayStart } = await import('@/lib/period');
  const result = await prisma.expense.groupBy({
    by: ['category'],
    where: { expenseDate: { gte: parseDayStart(from), lte: parseDayEnd(to) } },
    _sum: { amount: true },
  });
  const byCategory = result.map((r) => ({
    category: r.category,
    total: Number(r._sum.amount ?? 0),
  }));
  const total = byCategory.reduce((a, r) => a + r.total, 0);
  return { total, byCategory };
}
