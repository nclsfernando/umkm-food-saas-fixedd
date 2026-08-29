import { prisma } from '@/lib/db';

/**
 * HPP from product cost (Product.hpp), never from OrderItem.unitPrice (selling price).
 * Marketplace imports often lack product match → HPP = 0; profit = net sales − expenses.
 */
export async function calculateHpp(from: Date, to: Date): Promise<number> {
  const [items, products] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { status: 'COMPLETED', orderDate: { gte: from, lte: to } } },
      select: { productName: true, qty: true },
    }),
    prisma.product.findMany({ select: { name: true, hpp: true } }),
  ]);

  const hppByName = new Map(
    products.map((p) => [p.name.trim().toLowerCase(), Number(p.hpp)]),
  );

  return items.reduce((acc, item) => {
    const unitHpp = hppByName.get(item.productName.trim().toLowerCase());
    if (unitHpp == null || Number.isNaN(unitHpp) || unitHpp <= 0) return acc;
    return acc + unitHpp * item.qty;
  }, 0);
}
