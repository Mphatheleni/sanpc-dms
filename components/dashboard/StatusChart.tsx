'use client'

import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts'

interface DataPoint {
  status: string
  count: number
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:               '#94A3B8',
  PENDING_REVIEW:      '#F59E0B',
  IN_REVIEW:           '#3B82F6',
  REVIEW_COMPLETE:     '#8B5CF6',
  PENDING_APPROVAL:    '#F97316',
  APPROVED:            '#22C55E',
  REJECTED:            '#EF4444',
  CHANGES_REQUESTED:   '#EAB308',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT:               'Draft',
  PENDING_REVIEW:      'Pending Review',
  IN_REVIEW:           'In Review',
  REVIEW_COMPLETE:     'Review Complete',
  PENDING_APPROVAL:    'Pending Approval',
  APPROVED:            'Approved',
  REJECTED:            'Rejected',
  CHANGES_REQUESTED:   'Changes Requested',
}

interface Props {
  data: DataPoint[]
}

export default function StatusChart({ data }: Props) {
  const chartData = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: STATUS_LABELS[d.status] ?? d.status,
      value: d.count,
      color: STATUS_COLORS[d.status] ?? '#94A3B8',
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        No documents yet
      </div>
    )
  }

  return (
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
        >
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ fontSize: 11, color: '#6B7280' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
