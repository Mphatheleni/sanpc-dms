import { verifyReviewToken } from '@/lib/reviewToken'
import { prisma } from '@/lib/db'
import { getDeadlineLabel, isReviewOverdue } from '@/lib/sla'
import ReviewExperience from './ReviewExperience'
import { AlertTriangle } from 'lucide-react'
import Image from 'next/image'

interface Props {
  params: Promise<{ token: string }>
}

export default async function ReviewTokenPage({ params }: Props) {
  const { token } = await params

  const payload = await verifyReviewToken(token)
  if (!payload) return <ErrorPage message="This review link is invalid or has expired." />

  const { documentId, reviewId, reviewerId, isApprover } = payload

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true, title: true, description: true, status: true,
      category: true, fileName: true, fileSize: true, version: true,
      sharePointUrl: true,
      uploadedBy: { select: { name: true } },
      reviews: {
        where: { id: reviewId },
        include: { reviewer: { select: { name: true, email: true } } },
      },
      comments: {
        include: { author: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!document) return <ErrorPage message="Document not found." />

  const review = document.reviews[0]
  if (!review) return <ErrorPage message="Review record not found." />

  // Approvers are activated when doc is FINAL_DRAFT (advance route); PENDING_APPROVAL is a legacy fallback
  const expectedStatuses = isApprover ? ['FINAL_DRAFT', 'PENDING_APPROVAL'] : ['IN_REVIEW']
  const alreadyDone = review.status === 'APPROVED' || review.status === 'REJECTED'
  const wrongStage  = !expectedStatuses.includes(document.status) && !alreadyDone

  const overdue      = isReviewOverdue(review.startedAt, review.deadline)
  const deadlineLabel = getDeadlineLabel(review.deadline)

  // Serialize dates to strings for client component
  const serializedComments = document.comments.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <ReviewExperience
      token={token}
      documentId={documentId}
      documentTitle={document.title}
      documentDescription={document.description}
      fileName={document.fileName}
      fileSize={document.fileSize}
      category={document.category}
      sharePointUrl={document.sharePointUrl}
      uploaderName={document.uploadedBy.name}
      reviewerName={review.reviewer.name}
      reviewerEmail={review.reviewer.email}
      isApprover={isApprover}
      alreadyDone={alreadyDone}
      wrongStage={wrongStage}
      reviewStatus={review.status}
      deadlineLabel={deadlineLabel}
      overdue={overdue}
      initialComments={serializedComments}
      version={document.version}
    />
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f4f6f9' }}>
      <div style={{ backgroundColor: '#1C3557' }} className="px-6 py-3.5 flex items-center gap-3">
        <Image src="/logo.png" alt="SANPC" width={28} height={28} style={{ objectFit: 'contain' }} unoptimized />
        <div>
          <div className="text-white font-extrabold text-base">SANPC DMS</div>
          <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#F5A623' }}>Powering Your Tomorrow</div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center max-w-sm w-full">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Link Not Valid</h1>
          <p className="text-sm text-gray-500">{message}</p>
          <p className="text-xs text-gray-400 mt-4">Please contact your document manager if you believe this is an error.</p>
        </div>
      </div>
    </div>
  )
}
