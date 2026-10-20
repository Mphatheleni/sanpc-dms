import Link from 'next/link'
import { FileX, ArrowLeft } from 'lucide-react'

export default function PortalNotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 text-center">
      <div className="flex justify-center mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl" style={{ backgroundColor: '#E8EDF4' }}>
          <FileX className="h-10 w-10" style={{ color: '#1C3557' }} />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Document Not Found</h1>
      <p className="text-gray-500 mb-8 max-w-md mx-auto">
        This document does not exist or has not been published to the portal. Only controlled documents are available.
      </p>
      <Link
        href="/portal/documents"
        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
        style={{ backgroundColor: '#1C3557' }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Document Library
      </Link>
    </div>
  )
}
