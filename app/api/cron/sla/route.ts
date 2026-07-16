import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendReviewNotification } from '@/lib/email'
import { signReviewToken } from '@/lib/reviewToken'

/**
 * GET /api/cron/sla
 * Called by a scheduler (e.g. Vercel Cron, task scheduler) daily.
 * Secured via CRON_SECRET header.
 *
 * 1. Day 18  — Send reminder emails to IN_PROGRESS reviewers who haven't responded
 * 2. Day 21+ — Auto-advance review to APPROVED (timed-out, no response)
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const DAY_MS = 24 * 60 * 60 * 1000
  const DAY18 = new Date(now.getTime() - 18 * DAY_MS)
  const DAY21 = new Date(now.getTime() - 21 * DAY_MS)
  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  // ── 1. Day-18 reminders ───────────────────────────────────────────────────
  const reminderCandidates = await prisma.documentReview.findMany({
    where: {
      status: 'IN_PROGRESS',
      startedAt: { lte: DAY18 },
      reminderSentAt: null,         // not yet reminded
    },
    include: {
      reviewer: { select: { id: true, name: true, email: true } },
      document: { select: { id: true, title: true, sharePointUrl: true, uploadedBy: { select: { name: true } } } },
    },
  })

  let remindersSet = 0
  for (const rev of reminderCandidates) {
    try {
      const token = await signReviewToken({
        documentId: rev.documentId,
        reviewId: rev.id,
        reviewerId: rev.reviewer.id,
        isApprover: rev.isApprover,
      })
      await sendReviewNotification({
        toEmail: rev.reviewer.email,
        toName: rev.reviewer.name,
        documentTitle: rev.document.title,
        documentUrl: `${appUrl}/documents/${rev.documentId}`,
        reviewUrl: `${appUrl}/review/${token}`,
        sharePointUrl: rev.document.sharePointUrl,
        deadline: rev.deadline?.toISOString() ?? null,
        isApprover: rev.isApprover,
        uploaderName: rev.document.uploadedBy.name,
        isReminder: true,
      })
      await prisma.documentReview.update({
        where: { id: rev.id },
        data: { reminderSentAt: now },
      })
      remindersSet++
    } catch (err) {
      console.error(`[sla-cron] reminder failed for review ${rev.id}:`, err)
    }
  }

  // ── 2. Day-21 auto-advance (timeout) ─────────────────────────────────────
  const timedOutReviews = await prisma.documentReview.findMany({
    where: {
      status: 'IN_PROGRESS',
      startedAt: { lte: DAY21 },
    },
    include: {
      document: { select: { id: true, status: true, reviews: { include: { reviewer: true } } } },
    },
  })

  let autoAdvanced = 0
  // Group by documentId to handle multi-reviewer documents
  const byDoc = new Map<string, typeof timedOutReviews>()
  for (const rev of timedOutReviews) {
    const list = byDoc.get(rev.documentId) ?? []
    list.push(rev)
    byDoc.set(rev.documentId, list)
  }

  for (const [documentId, revs] of byDoc) {
    const doc = revs[0].document
    if (doc.status !== 'IN_REVIEW' && doc.status !== 'PENDING_APPROVAL' && doc.status !== 'FINAL_DRAFT') continue

    // Mark all timed-out reviews as APPROVED (auto-passed)
    await prisma.documentReview.updateMany({
      where: { id: { in: revs.map((r) => r.id) }, status: 'IN_PROGRESS' },
      data: {
        status: 'APPROVED',
        reviewedAt: now,
        comments: 'Auto-approved: no response within 21 days (per CSS/PR/CSF/005)',
      },
    })

    // Check if all reviews for the document are now complete
    const allDocReviews = doc.reviews.filter((r) => !r.isApprover)
    const allApproverReviews = doc.reviews.filter((r) => r.isApprover)
    const updatedIds = new Set(revs.map((r) => r.id))

    if (doc.status === 'IN_REVIEW') {
      // Check if all reviewers are now done
      const allReviewersDone = allDocReviews.every(
        (r) => r.status === 'APPROVED' || updatedIds.has(r.id)
      )
      if (allReviewersDone) {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'REVIEW_COMPLETE' },
        })
        await prisma.documentActivity.create({
          data: {
            documentId,
            userId: revs[0].reviewerId,
            action: 'REVIEW_APPROVED',
            details: 'Auto-advanced: 21-day review timeout (CSS/PR/CSF/005)',
          },
        })
        autoAdvanced++
      }
    } else if (doc.status === 'PENDING_APPROVAL' || doc.status === 'FINAL_DRAFT') {
      const allApproversDone = allApproverReviews.every(
        (r) => r.status === 'APPROVED' || updatedIds.has(r.id)
      )
      if (allApproversDone) {
        await prisma.document.update({
          where: { id: documentId },
          data: { status: 'APPROVED' },
        })
        await prisma.documentActivity.create({
          data: {
            documentId,
            userId: revs[0].reviewerId,
            action: 'APPROVED',
            details: 'Auto-approved: 21-day approval timeout (CSS/PR/CSF/005)',
          },
        })
        autoAdvanced++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    reminders: remindersSet,
    autoAdvanced,
    checkedAt: now.toISOString(),
  })
}
