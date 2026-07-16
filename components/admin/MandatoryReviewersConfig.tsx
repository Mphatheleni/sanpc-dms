'use client'

import { useState } from 'react'
import { Users, X, UserPlus, ShieldCheck } from 'lucide-react'
import UserPicker, { type PickableUser } from '@/components/ui/UserPicker'

const SANPC_DOC_TYPES = [
  'Policy', 'Procedure', 'Work Practice', 'Work Instruction',
  'Strategy & Planning', 'Risk Matrix', 'Standard', 'Guidelines',
  'Training Material', 'Test Script', 'Process Flow', 'Form / Template',
  'Corporate Governance', 'Internal Specification', 'Business Continuity Plan',
  'Terms of Reference', 'Management System Manual',
]

interface MandatoryConfig {
  id: string
  documentType: string
  userId: string
  user: { id: string; name: string; email: string; role: string }
}

interface Props {
  initialConfigs: MandatoryConfig[]
  users: PickableUser[]
}

export default function MandatoryReviewersConfig({ initialConfigs, users }: Props) {
  const [configs, setConfigs] = useState<MandatoryConfig[]>(initialConfigs)
  const [selectedType, setSelectedType] = useState(SANPC_DOC_TYPES[0])
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pickerValue, setPickerValue] = useState<PickableUser | null>(null)

  const reviewersForType = configs.filter((c) => c.documentType === selectedType)
  const assignedUserIds = new Set(reviewersForType.map((c) => c.userId))
  // Only show reviewers/admins in the picker, exclude already-assigned ones
  const availableUsers = users.filter(
    (u) => (u.role === 'REVIEWER' || u.role === 'ADMIN') && !assignedUserIds.has(u.id)
  )

  async function addReviewer(user: PickableUser) {
    setSaving(true)
    setError('')
    const res = await fetch('/api/mandatory-reviewers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentType: selectedType, userId: user.id }),
    })
    if (res.ok) {
      const config = await res.json()
      setConfigs((prev) => [...prev, config])
      setPickerValue(null)
    } else {
      setError('Failed to add reviewer — try again')
    }
    setSaving(false)
  }

  async function removeReviewer(configId: string) {
    setRemoving(configId)
    setError('')
    const res = await fetch(`/api/mandatory-reviewers/${configId}`, { method: 'DELETE' })
    if (res.ok) {
      setConfigs((prev) => prev.filter((c) => c.id !== configId))
    } else {
      setError('Failed to remove — try again')
    }
    setRemoving(null)
  }

  const configuredTypes = new Set(configs.map((c) => c.documentType)).size

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100">
          <Users className="h-5 w-5 text-purple-700" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Mandatory Reviewers per Document Type</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Assign specific reviewers to each document type. When a Document Controller uploads that type,
            these people are automatically pre-selected as reviewers. The DC can still remove any of them.
            {configuredTypes > 0 && ` ${configuredTypes} document type${configuredTypes !== 1 ? 's' : ''} configured.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Document type list */}
        <div className="lg:col-span-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Document Type</p>
          <div className="flex flex-col gap-1">
            {SANPC_DOC_TYPES.map((t) => {
              const count = configs.filter((c) => c.documentType === t).length
              return (
                <button
                  key={t}
                  onClick={() => { setSelectedType(t); setPickerValue(null); setError('') }}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                    selectedType === t
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="truncate">{t}</span>
                  {count > 0 && (
                    <span className={`ml-2 flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      selectedType === t ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'
                    }`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Reviewers for selected type */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-gray-800">{selectedType}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {reviewersForType.length === 0
                  ? 'No mandatory reviewers — add people below.'
                  : `${reviewersForType.length} reviewer${reviewersForType.length !== 1 ? 's' : ''} pre-selected when uploading this document type.`}
              </p>
            </div>

            {/* Current reviewers */}
            <div className="p-4 space-y-2">
              {reviewersForType.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <ShieldCheck className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No mandatory reviewers yet</p>
                  <p className="text-xs mt-1">Add people below — they&apos;ll be pre-selected on upload.</p>
                </div>
              ) : (
                reviewersForType.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2.5"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
                      {c.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.user.name}</p>
                      <p className="text-xs text-gray-500 truncate">{c.user.email}</p>
                    </div>
                    <button
                      onClick={() => removeReviewer(c.id)}
                      disabled={removing === c.id}
                      className="flex-shrink-0 rounded-full p-1 text-gray-400 hover:bg-red-100 hover:text-red-500 transition-colors disabled:opacity-40"
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add reviewer */}
            <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add Reviewer</p>
              <UserPicker
                users={availableUsers}
                value={pickerValue}
                onChange={(u) => { if (u) { setPickerValue(u); addReviewer(u) } else setPickerValue(null) }}
                placeholder="Search reviewers to add…"
              />
              {saving && <p className="text-xs text-purple-600">Adding…</p>}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
