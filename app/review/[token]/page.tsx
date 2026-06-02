import { verifyReviewToken } from '@/lib/reviewToken'
import { prisma } from '@/lib/db'
import { getDeadlineLabel, isReviewOverdue } from '@/lib/sla'
import ReviewAction from './ReviewAction'
import { AlertTriangle } from 'lucide-react'

interface Props {
  params: Promise<{ token: string }>
}

export default async function ReviewTokenPage({ params }: Props) {
  const { token } = await params

  const payload = await verifyReviewToken(token)
  if (!payload) {
    return <ErrorPage message="This review link is invalid or has expired." />
  }

  const { documentId, reviewId, reviewerId, isApprover } = payload

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true, title: true, description: true, status: true,
      sharePointUrl: true,
      uploadedBy: { select: { name: true } },
      reviews: {
        where: { id: reviewId },
        include: { reviewer: { select: { name: true, email: true } } },
      },
    },
  })

  if (!document) return <ErrorPage message="Document not found." />

  const review = document.reviews[0]
  if (!review) return <ErrorPage message="Review record not found." />

  const expectedStatus = isApprover ? 'PENDING_APPROVAL' : 'IN_REVIEW'
  const alreadyDone = review.status === 'APPROVED' || review.status === 'REJECTED'
  const wrongStage = document.status !== expectedStatus && !alreadyDone

  const deadline = review.deadline
  const overdue = isReviewOverdue(review.startedAt, deadline)
  const deadlineLabel = getDeadlineLabel(deadline)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#1C3557] px-6 py-4 flex items-center gap-3">
        <div>
          <div className="text-white font-extrabold text-lg tracking-tight">SANPC DMS</div>
          <div className="text-[#F5A623] text-[10px] font-semibold tracking-widest uppercase">
            Powering Your Tomorrow
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center p-6 pt-10">
        <div className="w-full max-w-xl space-y-4">

          {/* Document card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
                {isApprover ? 'Approval Required' : 'Review Required'}
              </p>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{document.title}</h1>
              {document.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{document.description}</p>
              )}
            </div>

            <div className="px-6 py-4 flex flex-wrap gap-4 text-sm border-b border-gray-100">
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide block">Uploaded by</span>
                <span className="font-medium text-gray-800">{document.uploadedBy.name}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide block">Assigned to</span>
                <span className="font-medium text-gray-800">{review.reviewer.name}</span>
              </div>
              {deadlineLabel && (
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wide block">Deadline</span>
                  <span className={`font-semibold flex items-center gap-1 ${overdue ? 'text-red-600' : 'text-amber-600'}`}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {deadlineLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Inline action component */}
            <ReviewAction
              token={token}
              documentId={documentId}
              documentTitle={document.title}
              sharePointUrl={document.sharePointUrl}
              isApprover={isApprover}
              alreadyDone={alreadyDone}
              wrongStage={wrongStage}
              reviewStatus={review.status}
            />
          </div>

          <p className="text-center text-xs text-gray-400">
            This is a secure, personalized link for <strong>{review.reviewer.email}</strong>. Do not share it.
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-[#1C3557] px-6 py-4">
        <div className="text-white font-extrabold text-lg">SANPC DMS</div>
        <div className="text-[#F5A623] text-[10px] font-semibold tracking-widest uppercase">
          Powering Your Tomorrow
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Link Not Valid</h1>
          <p className="text-sm text-gray-500">{message}</p>
          <p className="text-xs text-gray-400 mt-4">
            Please contact your document manager if you believe this is an error.
          </p>
        </div>
      </div>
    </div>
  )
}
