'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Download, AlertTriangle, FileText, CheckCircle, Clock, TrendingUp } from 'lucide-react'

interface ReportsData {
  statusCounts: { status: string; count: number }[]
  categoryCounts: { category: string; count: number }[]
  monthlySubmissions: { month: string; count: number }[]
  overdueList: { id: string; title: string; reviewerName: string; deadline: string | null; daysOverdue: number }[]
  reviewerStats: { name: string; assigned: number; completed: number; avgDays: number | null }[]
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94A3B8',
  PENDING_REVIEW: '#F59E0B',
  IN_REVIEW: '#3B82F6',
  REVIEW_COMPLETE: '#8B5CF6',
  PENDING_APPROVAL: '#F97316',
  APPROVED: '#22C55E',
  REJECTED: '#EF4444',
  CHANGES_REQUESTED: '#EAB308',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending Review',
  IN_REVIEW: 'In Review',
  REVIEW_COMPLETE: 'Review Complete',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CHANGES_REQUESTED: 'Changes Req.',
}

export default function ReportsClient() {
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-sanpc-navy border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading reports…</p>
        </div>
      </div>
    )
  }

  if (!data) return <div className="text-center py-20 text-gray-400">Failed to load reports</div>

  const totalDocs = data.statusCounts.reduce((s, d) => s + d.count, 0)
  const approvedCount = data.statusCounts.find((d) => d.status === 'APPROVED')?.count ?? 0
  const approvedPct = totalDocs > 0 ? Math.round((approvedCount / totalDocs) * 100) : 0
  const overdueCount = data.overdueList.length
  const completedReviews = data.reviewerStats.reduce((s, r) => s + r.completed, 0)
  const totalAssigned = data.reviewerStats.reduce((s, r) => s + r.assigned, 0)
  const avgDays = data.reviewerStats.filter((r) => r.avgDays !== null).map((r) => r.avgDays as number)
  const avgReviewDays = avgDays.length > 0 ? (avgDays.reduce((s, d) => s + d, 0) / avgDays.length).toFixed(1) : '—'

  const statusChartData = data.statusCounts
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: STATUS_LABELS[d.status] ?? d.status,
      count: d.count,
      fill: STATUS_COLORS[d.status] ?? '#94A3B8',
    }))

  const catChartData = data.categoryCounts.slice(0, 6)

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: FileText, label: 'Total Documents', value: totalDocs, color: 'text-sanpc-navy bg-sanpc-navy-light' },
          { icon: CheckCircle, label: 'Approval Rate', value: `${approvedPct}%`, color: 'text-green-600 bg-green-50' },
          { icon: Clock, label: 'Avg Review Time', value: `${avgReviewDays}d`, color: 'text-purple-600 bg-purple-50' },
          { icon: AlertTriangle, label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'text-red-600 bg-red-50' : 'text-gray-400 bg-gray-100', alert: overdueCount > 0 },
        ].map(({ icon: Icon, label, value, color, alert }) => (
          <div key={label} className={`rounded-xl border p-5 bg-white shadow-sm flex items-start gap-4 ${alert ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
            <div className={`rounded-xl p-3 flex-shrink-0 ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className={`text-2xl font-bold ${alert ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
              <p className={`text-sm mt-0.5 ${alert ? 'text-red-500' : 'text-gray-500'}`}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status BarChart */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Documents by Status</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={statusChartData} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {statusChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category BarChart */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Documents by Category</h2>
          {catChartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No category data</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={catChartData} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={130} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" fill="#1C3557" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly Submissions LineChart */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-sanpc-navy" />
          Monthly Submissions (Last 6 Months)
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data.monthlySubmissions} margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line type="monotone" dataKey="count" stroke="#1C3557" strokeWidth={2} dot={{ r: 4, fill: '#F5A623' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Overdue Table */}
      {data.overdueList.length > 0 && (
        <div className="rounded-xl border border-red-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-red-100 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-red-700">Overdue Reviews ({data.overdueList.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reviewer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Days Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.overdueList.map((item) => (
                  <tr key={`${item.id}-${item.reviewerName}`} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <a href={`/documents/${item.id}`} className="font-medium text-gray-800 hover:text-sanpc-navy hover:underline">
                        {item.title}
                      </a>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{item.reviewerName}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700">
                        {item.daysOverdue}d overdue
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reviewer Performance Table */}
      {data.reviewerStats.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Reviewer Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reviewer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assigned</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Completed</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Completion Rate</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.reviewerStats.sort((a, b) => b.assigned - a.assigned).map((r, i) => {
                  const rate = r.assigned > 0 ? Math.round((r.completed / r.assigned) * 100) : 0
                  return (
                    <tr key={`${r.name}-${i}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-800">{r.name}</td>
                      <td className="px-5 py-3.5 text-gray-600">{r.assigned}</td>
                      <td className="px-5 py-3.5 text-gray-600">{r.completed}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${rate}%`,
                                backgroundColor: rate === 100 ? '#22C55E' : rate >= 60 ? '#F59E0B' : '#EF4444',
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{rate}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{r.avgDays !== null ? `${r.avgDays}d` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
