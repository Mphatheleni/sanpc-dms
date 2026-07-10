import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { REVIEW_SLA_HOURS } from '@/lib/sla'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'ADMIN' && session.role !== 'DOCUMENT_MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const statuses = [
    'DRAFT', 'PENDING_REVIEW', 'IN_REVIEW', 'REVIEW_COMPLETE',
    'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED',
  ]

  const statusCounts = await Promise.all(
    statuses.map(async (status) => ({
      status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      count: await prisma.document.count({ where: { status: status as any } }),
    }))
  )

  // Category counts
  const rawCategories = await prisma.document.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })
  const categoryCounts = rawCategories.map((r) => ({
    category: r.category ?? 'Uncategorised',
    count: r._count.id,
  }))

  // Monthly submissions (last 6 months)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const recentDocs = await prisma.document.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true },
  })

  const monthlyMap: Record<string, number> = {}
  for (let i = 0; i < 6; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    monthlyMap[key] = 0
  }
  recentDocs.forEach((doc) => {
    const key = new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    if (key in monthlyMap) monthlyMap[key]++
  })
  const monthlySubmissions = Object.entries(monthlyMap).map(([month, count]) => ({ month, count }))

  // Overdue list
  const slaDeadline = new Date(Date.now() - REVIEW_SLA_HOURS * 3600 * 1000)
  const overdueReviews = await prisma.documentReview.findMany({
    where: { status: 'IN_PROGRESS', startedAt: { lt: slaDeadline } },
    include: {
      reviewer: { select: { name: true } },
      document: { select: { id: true, title: true } },
    },
  })

  const overdueList = overdueReviews.map((r) => ({
    id: r.document.id,
    title: r.document.title,
    reviewerName: r.reviewer.name,
    deadline: r.deadline ?? null,
    daysOverdue: r.startedAt
      ? Math.floor((Date.now() - new Date(r.startedAt).getTime() - REVIEW_SLA_HOURS * 3600 * 1000) / 86400000)
      : 0,
  }))

  // Reviewer performance
  const allReviews = await prisma.documentReview.findMany({
    where: { isApprover: false },
    include: { reviewer: { select: { name: true } } },
  })

  const reviewerMap: Record<string, { name: string; assigned: number; completed: number; totalDays: number }> = {}
  allReviews.forEach((r) => {
    const key = r.reviewerId
    if (!reviewerMap[key]) reviewerMap[key] = { name: r.reviewer.name, assigned: 0, completed: 0, totalDays: 0 }
    reviewerMap[key].assigned++
    if (r.reviewedAt && r.startedAt) {
      reviewerMap[key].completed++
      reviewerMap[key].totalDays += (new Date(r.reviewedAt).getTime() - new Date(r.startedAt).getTime()) / 86400000
    }
  })

  const reviewerStats = Object.values(reviewerMap).map((r) => ({
    name: r.name,
    assigned: r.assigned,
    completed: r.completed,
    avgDays: r.completed > 0 ? Math.round((r.totalDays / r.completed) * 10) / 10 : null,
  }))

  return NextResponse.json({
    statusCounts,
    categoryCounts,
    monthlySubmissions,
    overdueList,
    reviewerStats,
  })
}
