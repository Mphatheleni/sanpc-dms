import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendReviewNotification, sendDeadlineExpiredEmail } from '@/lib/email'
import { signReviewToken } from '@/lib/reviewToken'
import { createNotification } from '@/lib/notify'

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

  // ── 2. Deadline expired — move IN_REVIEW docs to CHANGES_REQUESTED ───────
  // Uses the explicit per-review deadline field (respects per-doc reviewDeadlineDays setting)
  const expiredReviews = await prisma.documentReview.findMany({
    where: {
      status: 'IN_PROGRESS',
      isApprover: false,
      deadline: { lte: now },
      document: { status: 'IN_REVIEW' },
    },
    select: {
      id: true,
      documentId: true,
      document: {
        select: {
          id: true, title: true,
          uploadedById: true, originatorId: true,
          uploadedBy: { select: { id: true, name: true, email: true } },
          originatorUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  // De-duplicate — only process each document once
  const seenDocs = new Set<string>()
  let deadlineExpired = 0

  for (const rev of expiredReviews) {
    if (seenDocs.has(rev.documentId)) continue
    seenDocs.add(rev.documentId)
    const doc = rev.document
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const documentUrl = `${appUrl}/documents/${rev.documentId}`

    try {
      await prisma.$transaction([
        // Pause all still-active reviewer reviews
        prisma.documentReview.updateMany({
          where: { documentId: rev.documentId, isApprover: false, status: 'IN_PROGRESS' },
          data: { status: 'PENDING', startedAt: null, deadline: null },
        }),
        // Move document to CHANGES_REQUESTED
        prisma.document.update({
          where: { id: rev.documentId },
          data: { status: 'CHANGES_REQUESTED' as never },
        }),
        // Audit log
        prisma.documentActivity.create({
          data: {
            documentId: rev.documentId,
            userId: doc.uploadedById,
            action: 'STATUS_CHANGED',
            details: 'IN_REVIEW → CHANGES_REQUESTED (review deadline expired — CSS/PR/CSF/005)',
          },
        }),
      ])

      // In-app: notify DC
      createNotification(
        doc.uploadedById,
        'STATUS_CHANGE',
        `Review Deadline Expired: ${doc.title}`,
        `The review period for "${doc.title}" has ended. The document has been returned to Changes Requested.`,
        rev.documentId,
      )

      // In-app: notify originator (if different from DC)
      const originatorId = doc.originatorId
      if (originatorId && originatorId !== doc.uploadedById) {
        createNotification(
          originatorId,
          'CHANGES_REQUESTED',
          `Review Deadline Expired: ${doc.title}`,
          `The 21-day review window for "${doc.title}" has closed. Please update the document and resubmit.`,
          rev.documentId,
        )
      }

      // Email: DC
      await sendDeadlineExpiredEmail({
        toEmail: doc.uploadedBy.email,
        toName: doc.uploadedBy.name,
        documentTitle: doc.title,
        documentUrl,
        isDC: true,
      }).catch((e) => console.error('[sla-cron] DC deadline email error:', e))

      // Email: originator (if different from DC)
      if (doc.originatorUser && doc.originatorUser.id !== doc.uploadedById) {
        await sendDeadlineExpiredEmail({
          toEmail: doc.originatorUser.email,
          toName: doc.originatorUser.name,
          documentTitle: doc.title,
          documentUrl,
          isDC: false,
        }).catch((e) => console.error('[sla-cron] originator deadline email error:', e))
      }

      deadlineExpired++
    } catch (err) {
      console.error(`[sla-cron] deadline-expire failed for doc ${rev.documentId}:`, err)
    }
  }

  // ── 3. Approver deadline expired — move FINAL_DRAFT/PENDING_APPROVAL to CHANGES_REQUESTED ──
  const expiredApprovals = await prisma.documentReview.findMany({
    where: {
      status: 'IN_PROGRESS',
      isApprover: true,
      deadline: { lte: now },
      document: { status: { in: ['FINAL_DRAFT', 'PENDING_APPROVAL'] } },
    },
    select: {
      id: true,
      documentId: true,
      document: {
        select: {
          id: true, title: true,
          uploadedById: true, originatorId: true,
          uploadedBy: { select: { id: true, name: true, email: true } },
          originatorUser: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  const seenApprovalDocs = new Set<string>()
  let approvalDeadlineExpired = 0

  for (const rev of expiredApprovals) {
    if (seenApprovalDocs.has(rev.documentId)) continue
    seenApprovalDocs.add(rev.documentId)
    const doc = rev.document
    const documentUrl = `${appUrl}/documents/${rev.documentId}`

    try {
      await prisma.$transaction([
        prisma.documentReview.updateMany({
          where: { documentId: rev.documentId, isApprover: true, status: 'IN_PROGRESS' },
          data: { status: 'PENDING', startedAt: null, deadline: null },
        }),
        prisma.document.update({
          where: { id: rev.documentId },
          data: { status: 'CHANGES_REQUESTED' as never },
        }),
        prisma.documentActivity.create({
          data: {
            documentId: rev.documentId,
            userId: doc.uploadedById,
            action: 'STATUS_CHANGED',
            details: 'FINAL_DRAFT → CHANGES_REQUESTED (approver deadline expired)',
          },
        }),
      ])

      createNotification(doc.uploadedById, 'STATUS_CHANGE', `Approval Deadline Expired: ${doc.title}`,
        `The approval period for "${doc.title}" has ended. The document has been returned to Changes Requested.`, rev.documentId)

      if (doc.originatorId && doc.originatorId !== doc.uploadedById) {
        createNotification(doc.originatorId, 'CHANGES_REQUESTED', `Approval Deadline Expired: ${doc.title}`,
          `The approval window for "${doc.title}" has closed. Please update and resubmit.`, rev.documentId)
      }

      await sendDeadlineExpiredEmail({
        toEmail: doc.uploadedBy.email, toName: doc.uploadedBy.name,
        documentTitle: doc.title, documentUrl, isDC: true,
      }).catch((e) => console.error('[sla-cron] approver DC deadline email error:', e))

      if (doc.originatorUser && doc.originatorUser.id !== doc.uploadedById) {
        await sendDeadlineExpiredEmail({
          toEmail: doc.originatorUser.email, toName: doc.originatorUser.name,
          documentTitle: doc.title, documentUrl, isDC: false,
        }).catch((e) => console.error('[sla-cron] approver originator deadline email error:', e))
      }

      approvalDeadlineExpired++
    } catch (err) {
      console.error(`[sla-cron] approver deadline-expire failed for doc ${rev.documentId}:`, err)
    }
  }

  return NextResponse.json({
    ok: true,
    reminders: remindersSet,
    deadlineExpired,
    approvalDeadlineExpired,
    checkedAt: now.toISOString(),
  })
}
