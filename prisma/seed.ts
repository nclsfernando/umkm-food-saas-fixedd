import { PrismaClient } from '../generated/prisma'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('felice123', 10)
  
  await prisma.user.upsert({
    where: { email: 'demo@umkmfood.id' },
    update: {},
    create: {
      email: 'demo@umkmfood.id',
      password: hashedPassword,
      name: 'Demo User',
      role: 'user',
    },
  })

  console.log('✅ User demo berhasil dibuat!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())