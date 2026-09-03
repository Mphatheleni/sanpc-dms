'use client'

import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts'

interface DataPoint {
  status: string
  count: number
}

const STATUS_COLORS: Record<string, string> = {
  REGISTERED:          '#64748B',
  DRAFT:               '#94A3B8',
  PENDING_REVIEW:      '#F59E0B',
  IN_REVIEW:           '#3B82F6',
  UPDATING:            '#06B6D4',
  REVIEW_COMPLETE:     '#8B5CF6',
  FINAL_DRAFT:         '#F97316',
  PENDING_APPROVAL:    '#EC4899',
  APPROVED:            '#22C55E',
  REJECTED:            '#EF4444',
  CHANGES_REQUESTED:   '#EAB308',
  CONTROLLED:          '#16A34A',
  SUPERSEDED:          '#4B5563',
  CANCELLED:           '#1F2937',
}

const STATUS_LABELS: Record<string, string> = {
  REGISTERED:          'Registered',
  DRAFT:               'Draft',
  PENDING_REVIEW:      'Pending Review',
  IN_REVIEW:           'In Review',
  UPDATING:            'Updating',
  REVIEW_COMPLETE:     'Review Complete',
  FINAL_DRAFT:         'Final Draft',
  PENDING_APPROVAL:    'Pending Approval',
  APPROVED:            'Approved',
  REJECTED:            'Rejected',
  CHANGES_REQUESTED:   'Changes Requested',
  CONTROLLED:          'Controlled',
  SUPERSEDED:          'Superseded',
  CANCELLED:           'Cancelled',
}

interface Props {
  data: DataPoint[]
}

export default function StatusChart({ data }: Props) {
  const router = useRouter()

  const chartData = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: STATUS_LABELS[d.status] ?? d.status,
      value: d.count,
      color: STATUS_COLORS[d.status] ?? '#94A3B8',
      status: d.status,
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        No documents yet
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleClick(entry: any) {
    if (entry?.status) router.push(`/documents?status=${entry.status}`)
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2 text-right">Click a segment to filter documents</p>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            onClick={handleClick}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} stroke="white" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value) => [value, 'Documents']}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: 11, color: '#6B7280' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
