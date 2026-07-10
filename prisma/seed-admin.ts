import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const password = await bcrypt.hash('Shudu@207', 10)
  const user = await prisma.user.upsert({
    where:  { email: 'mphatheleni.matidze@sa-npc.co.za' },
    update: { name: 'Mphatheleni Matidze', role: 'ADMIN', password },
    create: { name: 'Mphatheleni Matidze', email: 'mphatheleni.matidze@sa-npc.co.za', role: 'ADMIN', password },
  })
  console.log('Done:', user.email, user.role)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
