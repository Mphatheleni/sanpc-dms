import type { DocumentMetadata } from '@/types'

export default function MetadataList({ metadata }: { metadata: DocumentMetadata[] }) {
  if (!metadata.length) return <p className="text-sm text-gray-400">No metadata</p>
  return (
    <dl className="divide-y divide-gray-100">
      {metadata.map((m) => (
        <div key={m.id} className="flex gap-4 py-2 text-sm">
          <dt className="w-32 flex-shrink-0 font-medium text-gray-600">{m.key}</dt>
          <dd className="text-gray-800 break-all">{m.value}</dd>
        </div>
      ))}
    </dl>
  )
}
