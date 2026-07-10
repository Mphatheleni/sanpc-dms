import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/documents/next-number?subject=CSS&type=PR&unit=CSF
 * Returns the next available sequential number for the given doc type pattern.
 * e.g. { nextNumber: "006", preview: "CSS/PR/CSF/006" }
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const subject = searchParams.get('subject')?.toUpperCase() ?? ''
  const type    = searchParams.get('type')?.toUpperCase() ?? ''
  const unit    = searchParams.get('unit')?.toUpperCase() ?? ''

  if (!subject || !type || !unit) {
    return NextResponse.json({ error: 'subject, type and unit are required' }, { status: 400 })
  }

  const prefix = `${subject}/${type}/${unit}/`

  // Find all documents whose documentNumber starts with this prefix
  const docs = await prisma.document.findMany({
    where: { documentNumber: { startsWith: prefix } },
    select: { documentNumber: true },
  })

  // Extract sequential numbers, find max
  let maxSeq = 0
  for (const doc of docs) {
    if (!doc.documentNumber) continue
    const seq = parseInt(doc.documentNumber.slice(prefix.length), 10)
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
  }

  const nextSeq = maxSeq + 1
  const nextNumber = String(nextSeq).padStart(3, '0')
  const preview = `${prefix}${nextNumber}`

  return NextResponse.json({ nextNumber, preview, subject, type, unit })
}
