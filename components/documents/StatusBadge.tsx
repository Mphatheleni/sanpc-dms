import Badge from '@/components/ui/Badge'
import type { DocumentStatus, ReviewStatus } from '@/types'

const statusConfig: Record<
  DocumentStatus | ReviewStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary' }
> = {
  REGISTERED: { label: 'Registered', variant: 'default' },
  DRAFT: { label: 'Draft', variant: 'default' },
  PENDING_REVIEW: { label: 'Pending Review', variant: 'warning' },
  IN_REVIEW: { label: 'In Review', variant: 'info' },
  UPDATING: { label: 'Request Update', variant: 'warning' },
  REVIEW_COMPLETE: { label: 'Review Complete', variant: 'warning' },
  FINAL_DRAFT: { label: 'Final Draft', variant: 'secondary' },
  PENDING_APPROVAL: { label: 'Pending Approval', variant: 'secondary' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  CHANGES_REQUESTED: { label: 'Changes Requested', variant: 'warning' },
  EXCO_PENDING: { label: 'EXCO Pending', variant: 'secondary' },
  CONTROLLED: { label: 'Controlled', variant: 'success' },
  SUPERSEDED: { label: 'Superseded', variant: 'secondary' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  PENDING: { label: 'Pending', variant: 'default' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  REMOVED: { label: 'Removed', variant: 'danger' },
}

interface StatusBadgeProps {
  status: DocumentStatus | ReviewStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
