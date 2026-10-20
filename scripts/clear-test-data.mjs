// Run with: node --env-file=.env.local scripts/clear-test-data.mjs
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const count = await prisma.document.count()
console.log(`Found ${count} document(s) — deleting...`)

const [activities, comments, reviews, versions, attachments, notifications, docs] = await prisma.$transaction([
  prisma.documentActivity.deleteMany({}),
  prisma.documentComment.deleteMany({}),
  prisma.documentReview.deleteMany({}),
  prisma.documentVersion.deleteMany({}),
  prisma.documentAttachment.deleteMany({}),
  prisma.notification.deleteMany({}),
  prisma.document.deleteMany({}),
])

console.log(`✓ Deleted:`)
console.log(`  ${docs.count} documents`)
console.log(`  ${reviews.count} reviews`)
console.log(`  ${versions.count} versions`)
console.log(`  ${attachments.count} attachments`)
console.log(`  ${comments.count} comments`)
console.log(`  ${activities.count} activity logs`)
console.log(`  ${notifications.count} notifications`)
console.log(`\nDone. Users untouched.`)

await prisma.$disconnect()
