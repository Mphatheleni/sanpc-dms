import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const password = await bcrypt.hash('password', 10)

  const accounts = [
    // Admin & managers
    { name: 'Admin User',        email: 'admin@sanpc.com',    role: 'ADMIN'            as const },
    { name: 'Document Manager',  email: 'manager@sanpc.com',  role: 'DOCUMENT_MANAGER' as const },

    // 8 Reviewers
    { name: 'Alice Reviewer',    email: 'alice@sanpc.com',    role: 'REVIEWER' as const },
    { name: 'Bob Reviewer',      email: 'bob@sanpc.com',      role: 'REVIEWER' as const },
    { name: 'Carol Reviewer',    email: 'carol@sanpc.com',    role: 'REVIEWER' as const },
    { name: 'David Reviewer',    email: 'david@sanpc.com',    role: 'REVIEWER' as const },
    { name: 'Eve Reviewer',      email: 'eve@sanpc.com',      role: 'REVIEWER' as const },
    { name: 'Frank Reviewer',    email: 'frank@sanpc.com',    role: 'REVIEWER' as const },
    { name: 'Grace Reviewer',    email: 'grace@sanpc.com',    role: 'REVIEWER' as const },
    { name: 'Henry Reviewer',    email: 'henry@sanpc.com',    role: 'REVIEWER' as const },

    // 8 Approvers
    { name: 'Ivy Approver',      email: 'ivy@sanpc.com',      role: 'APPROVER' as const },
    { name: 'Jack Approver',     email: 'jack@sanpc.com',     role: 'APPROVER' as const },
    { name: 'Karen Approver',    email: 'karen@sanpc.com',    role: 'APPROVER' as const },
    { name: 'Leo Approver',      email: 'leo@sanpc.com',      role: 'APPROVER' as const },
    { name: 'Mia Approver',      email: 'mia@sanpc.com',      role: 'APPROVER' as const },
    { name: 'Noah Approver',     email: 'noah@sanpc.com',     role: 'APPROVER' as const },
    { name: 'Olivia Approver',   email: 'olivia@sanpc.com',   role: 'APPROVER' as const },
    { name: 'Paul Approver',     email: 'paul@sanpc.com',     role: 'APPROVER' as const },
  ]

  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: { ...account, password },
    })
  }

  console.log(`Seeded ${accounts.length} accounts successfully.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
