import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
  value: number | string
  delta?: string
  alertColor?: boolean
}

export default function StatsCard({ icon: Icon, label, value, delta, alertColor }: Props) {
  return (
    <div
      className={`rounded-xl border p-5 bg-white shadow-sm flex items-start gap-4 ${alertColor ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}
    >
      <div
        className={`rounded-xl p-3 flex-shrink-0 ${alertColor ? 'bg-red-100 text-red-600' : 'bg-sanpc-navy-light text-sanpc-navy'}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className={`text-3xl font-bold tracking-tight ${alertColor ? 'text-red-700' : 'text-gray-900'}`}>
          {value}
        </p>
        <p className={`text-sm mt-0.5 ${alertColor ? 'text-red-500' : 'text-gray-500'}`}>{label}</p>
        {delta && (
          <p className="text-xs text-gray-400 mt-1">{delta}</p>
        )}
      </div>
    </div>
  )
}
