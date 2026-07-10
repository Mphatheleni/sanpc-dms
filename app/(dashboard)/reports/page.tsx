import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Download } from 'lucide-react'
import ReportsClient from './ReportsClient'

export default async function ReportsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN' && session.role !== 'DOCUMENT_MANAGER') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Document workflow performance and statistics</p>
        </div>
        <a
          href="/api/reports/export"
          download
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </div>

      <ReportsClient />
    </div>
  )
}
