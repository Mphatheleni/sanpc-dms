export type Role = 'ADMIN' | 'DOCUMENT_MANAGER' | 'REVIEWER' | 'APPROVER'

export type DocumentStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'IN_REVIEW'
  | 'REVIEW_COMPLETE'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXCO_PENDING'
  | 'CONTROLLED'
  | 'SUPERSEDED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'

export type ReviewStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'REJECTED'
  | 'CHANGES_REQUESTED'

export type ActivityAction =
  | 'CREATED'
  | 'VIEWED'
  | 'DOWNLOADED'
  | 'SUBMITTED'
  | 'REVIEW_APPROVED'
  | 'REVIEW_REJECTED'
  | 'REVIEW_CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMMENT_ADDED'
  | 'CONTROLLED'
  | 'SUPERSEDED'
  | 'CANCELLED'
  | 'EXCO_SUBMITTED'
  | 'SIGNED_PAGE_UPLOADED'
  | 'AMENDED'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
}

export interface DocumentMetadata {
  id: string
  key: string
  value: string
}

export interface DocumentReview {
  id: string
  reviewerId: string
  reviewer: User
  order: number
  isApprover: boolean
  status: ReviewStatus
  comments: string | null
  reviewedAt: string | null
  startedAt: string | null
  deadline: string | null
}

export interface DocumentComment {
  id: string
  authorId: string
  author: User
  content: string
  createdAt: string
}

export interface DocumentVersion {
  id: string
  versionNumber: number
  fileUrl: string
  fileName: string
  fileType: string
  fileSize: number
  uploadedById: string
  uploadedBy: User
  createdAt: string
}

export interface DocumentActivity {
  id: string
  action: ActivityAction
  details: string | null
  createdAt: string
  user: { name: string; email: string }
}

export interface Document {
  id: string
  title: string
  description: string | null
  category: string | null
  tags: string | null
  fileUrl: string
  fileName: string
  fileType: string
  fileSize: number
  status: DocumentStatus
  version: number
  sharePointUrl: string | null
  sharePointItemId: string | null
  reviewDeadlineDays: number | null
  documentNumber: string | null
  revision: string | null
  originalDate: string | null
  authorisedBy: string | null
  originator: string | null
  purpose: string | null
  documentTypeCode: string | null
  nextReviewDate: string | null
  retentionDate: string | null
  signedPageUrl: string | null
  signedPageName: string | null
  excoResolutionUrl: string | null
  excoResolutionName: string | null
  isExcoRequired: boolean
  controlledAt: string | null
  amendmentCount: number
  uploadedById: string
  uploadedBy: User
  createdAt: string
  updatedAt: string
  metadata: DocumentMetadata[]
  reviews: DocumentReview[]
  comments: DocumentComment[]
  versions: DocumentVersion[]
  activities: DocumentActivity[]
}

export interface DocumentReview {
  id: string
  reviewerId: string
  reviewer: User
  order: number
  isApprover: boolean
  isMandatory: boolean
  mandatoryRole: string | null
  status: ReviewStatus
  comments: string | null
  reviewedAt: string | null
  startedAt: string | null
  deadline: string | null
  reminderSentAt: string | null
}

export interface SessionUser {
  userId: string
  email: string
  role: Role
  name: string
}
