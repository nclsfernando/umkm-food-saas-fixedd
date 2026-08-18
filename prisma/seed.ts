import { PrismaClient } from '../generated/prisma'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_EMAIL || 'mama@umkmfood.id'
  const password = process.env.SEED_PASSWORD || 'Mama1234!'
  const hashedPassword = await bcrypt.hash(password, 10)

  const existingNew = await prisma.user.findUnique({ where: { email } })
  const existingDemo = await prisma.user.findUnique({ where: { email: 'demo@umkmfood.id' } })

  if (existingNew) {
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, name: 'Mama', role: 'user' },
    })
  } else if (existingDemo) {
    await prisma.user.update({
      where: { email: 'demo@umkmfood.id' },
      data: { email, password: hashedPassword, name: 'Mama', role: 'user' },
    })
  } else {
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Mama',
        role: 'user',
      },
    })
  }

  console.log(`✅ Login reset: ${email} / ${password}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
