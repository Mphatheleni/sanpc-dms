import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

function escapeCsv(value: string | null | undefined): string {
  const str = value ?? ''
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'ADMIN' && session.role !== 'DOCUMENT_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const documents = await prisma.document.findMany({
    include: {
      uploadedBy: { select: { name: true } },
      reviews: {
        include: { reviewer: { select: { name: true } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const headers = ['Title', 'Category', 'Status', 'Uploaded By', 'Date', 'Reviewers', 'Approvers', 'Version']
  const rows = documents.map((doc) => {
    const reviewers = doc.reviews.filter((r) => !r.isApprover).map((r) => r.reviewer.name).join('; ')
    const approvers = doc.reviews.filter((r) => r.isApprover).map((r) => r.reviewer.name).join('; ')
    return [
      escapeCsv(doc.title),
      escapeCsv(doc.category),
      escapeCsv(doc.status),
      escapeCsv(doc.uploadedBy.name),
      new Date(doc.createdAt).toISOString().split('T')[0],
      escapeCsv(reviewers || '—'),
      escapeCsv(approvers || '—'),
      String(doc.version),
    ].join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': "attachment; filename*=UTF-8''documents-report.csv",
    },
  })
}
