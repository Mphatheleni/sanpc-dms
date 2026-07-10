/**
 * seed-mandatory-reviewers.ts
 *
 * Creates the four mandatory reviewer accounts required by CSS/PR/CSF/005
 * for Policy (PO) and Procedure (PR) documents.
 *
 * Usage:
 *   npx tsx scripts/seed-mandatory-reviewers.ts
 *
 * Each user gets a temporary password that must be changed on first login.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./prisma/dev.db' })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any)

async function hashPassword(p: string): Promise<string> {
  return bcrypt.hash(p, 10)
}

const MANDATORY_USERS = [
  {
    name: 'Legal Representative',
    email: 'legal@sa-npc.co.za',
    role: 'REVIEWER' as const,
    departmentRole: 'LEGAL',
    tempPassword: 'Legal@SANPC2025',
  },
  {
    name: 'Internal Audit Representative',
    email: 'internal.audit@sa-npc.co.za',
    role: 'REVIEWER' as const,
    departmentRole: 'INTERNAL_AUDIT',
    tempPassword: 'Audit@SANPC2025',
  },
  {
    name: 'Quality Representative',
    email: 'quality@sa-npc.co.za',
    role: 'REVIEWER' as const,
    departmentRole: 'QUALITY',
    tempPassword: 'Quality@SANPC2025',
  },
  {
    name: 'Procedures Section Representative',
    email: 'procedures@sa-npc.co.za',
    role: 'REVIEWER' as const,
    departmentRole: 'PROCEDURES',
    tempPassword: 'Procedures@SANPC2025',
  },
]

async function main() {
  console.log('Seeding mandatory reviewer accounts...\n')

  for (const u of MANDATORY_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } })
    if (existing) {
      // Update departmentRole if not set
      if (!existing.departmentRole) {
        await prisma.user.update({
          where: { email: u.email },
          data: { departmentRole: u.departmentRole },
        })
        console.log(`  Updated departmentRole for ${u.email} → ${u.departmentRole}`)
      } else {
        console.log(`  Skipped (already exists): ${u.email}`)
      }
      continue
    }

    await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        password: await hashPassword(u.tempPassword),
        role: u.role,
        departmentRole: u.departmentRole,
      },
    })
    console.log(`  Created: ${u.email} (${u.departmentRole}) — temp password: ${u.tempPassword}`)
  }

  console.log('\nDone.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
