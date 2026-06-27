import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const categories = ['FOOD', 'BEVERAGE', 'DESSERT', 'SNACK'];
  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log('✅ Categories seeded');

  const existing = await prisma.user.findUnique({ where: { email: 'demo@umkmfood.id' } });
  if (!existing) {
    const hash = await bcrypt.hash('Demo1234!', 12);
    const owner = await prisma.user.create({
      data: {
        email: 'demo@umkmfood.id',
        passwordHash: hash,
        name: 'Demo Owner',
        businessName: 'Warung Geprek Bu Demo',
        role: 'OWNER',
      },
    });

    const foodCat = await prisma.category.findFirst({ where: { name: 'FOOD' } });
    const bevCat = await prisma.category.findFirst({ where: { name: 'BEVERAGE' } });

    const products = [
      { name: 'Ayam Geprek Original', categoryId: foodCat!.id, sellingPrice: '25000', hpp: '11000' },
      { name: 'Ayam Geprek Mozzarella', categoryId: foodCat!.id, sellingPrice: '32000', hpp: '15000' },
      { name: 'Nasi + Lauk Sayur', categoryId: foodCat!.id, sellingPrice: '18000', hpp: '8000' },
      { name: 'Rice Bowl Ayam Teriyaki', categoryId: foodCat!.id, sellingPrice: '30000', hpp: '14000' },
      { name: 'Es Teh Manis', categoryId: bevCat!.id, sellingPrice: '5000', hpp: '1500' },
      { name: 'Es Jeruk', categoryId: bevCat!.id, sellingPrice: '7000', hpp: '2500' },
      { name: 'Jus Alpukat', categoryId: bevCat!.id, sellingPrice: '15000', hpp: '6000' },
    ];

    for (const p of products) {
      await prisma.product.create({ data: p });
    }
    console.log(`✅ Demo user: demo@umkmfood.id / Demo1234!`);
    console.log(`✅ ${products.length} sample products created`);
  }

  console.log('✨ Seed complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
