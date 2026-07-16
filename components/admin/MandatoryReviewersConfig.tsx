'use client'

import { useState } from 'react'
import { Users, AlertCircle, CheckCircle2 } from 'lucide-react'

const SANPC_DOC_TYPES = [
  'Policy', 'Procedure', 'Work Practice', 'Work Instruction',
  'Strategy & Planning', 'Risk Matrix', 'Standard', 'Guidelines',
  'Training Material', 'Test Script', 'Process Flow', 'Form / Template',
  'Corporate Governance', 'Internal Specification', 'Business Continuity Plan',
  'Terms of Reference', 'Management System Manual',
]

const DEPT_ROLES = [
  { role: 'LEGAL',          label: 'Legal' },
  { role: 'INTERNAL_AUDIT', label: 'Internal Audit' },
  { role: 'QUALITY',        label: 'Quality' },
  { role: 'PROCEDURES',     label: 'Procedures Section' },
] as const

interface FunctionConfig {
  id: string
  documentType: string
  deptRole: string
  deptLabel: string
  user: { id: string; name: string; email: string; role: string } | null
}

interface User {
  id: string
  name: string
  email: string
  role: string
  departmentRole?: string | null
}

interface Props {
  initialConfigs: FunctionConfig[]
  users: User[]
}

export default function MandatoryReviewersConfig({ initialConfigs, users }: Props) {
  const [configs, setConfigs] = useState<FunctionConfig[]>(initialConfigs)
  const [selectedType, setSelectedType] = useState(SANPC_DOC_TYPES[0])
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const configsForType = configs.filter((c) => c.documentType === selectedType)
  const enabledRoles = new Set(configsForType.map((c) => c.deptRole))

  // Count how many doc types have at least one function configured
  const configuredTypes = new Set(configs.map((c) => c.documentType)).size

  async function toggle(deptRole: string, enabled: boolean) {
    setSaving(deptRole)
    setError('')

    if (enabled) {
      // Add
      const res = await fetch('/api/mandatory-reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType: selectedType, deptRole }),
      })
      if (res.ok) {
        const config = await res.json()
        setConfigs((prev) => [...prev, config])
      } else {
        setError('Failed to save — try again')
      }
    } else {
      // Remove
      const existing = configsForType.find((c) => c.deptRole === deptRole)
      if (!existing) { setSaving(null); return }
      const res = await fetch(`/api/mandatory-reviewers/${existing.id}`, { method: 'DELETE' })
      if (res.ok) {
        setConfigs((prev) => prev.filter((c) => c.id !== existing.id))
      } else {
        setError('Failed to remove — try again')
      }
    }

    setSaving(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100">
          <Users className="h-5 w-5 text-purple-700" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Mandatory Reviewer Functions</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure which functions (Legal, Internal Audit, Quality, Procedures) must review each document type.
            The person assigned to each function is managed via <strong>User Management → Department Role</strong>.
            {configuredTypes > 0 && ` ${configuredTypes} document type${configuredTypes !== 1 ? 's' : ''} configured.`}
          </p>
        </div>
      </div>

      {/* Current function → person assignments */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Current Function Assignments</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {DEPT_ROLES.map(({ role, label }) => {
            const person = users.find((u) => u.departmentRole === role)
            return (
              <div key={role} className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">{label}</p>
                {person ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-800 truncate">{person.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{person.email}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    <p className="text-[10px]">No user assigned</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          To change who holds a function, go to User Management and update their Department Role.
        </p>
      </div>

      {/* Document type selector */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Document Type</p>
        <div className="flex flex-wrap gap-2">
          {SANPC_DOC_TYPES.map((t) => {
            const count = configs.filter((c) => c.documentType === t).length
            return (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedType === t
                    ? 'border-purple-400 bg-purple-100 text-purple-800'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {t}
                {count > 0 && (
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    selectedType === t ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Function toggles for selected type */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-semibold text-gray-800">{selectedType}</p>
          <p className="text-xs text-gray-500">
            {enabledRoles.size === 0
              ? 'No mandatory functions — all reviewers are manually selected on upload.'
              : `${enabledRoles.size} function${enabledRoles.size !== 1 ? 's' : ''} required — auto-loaded on upload.`}
          </p>
        </div>

        <div className="divide-y divide-gray-50">
          {DEPT_ROLES.map(({ role, label }) => {
            const isEnabled = enabledRoles.has(role)
            const person = users.find((u) => u.departmentRole === role)
            const isSaving = saving === role

            return (
              <label
                key={role}
                className={`flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-colors ${
                  isEnabled ? 'bg-purple-50 hover:bg-purple-50/80' : 'hover:bg-gray-50'
                } ${isSaving ? 'opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  disabled={isSaving}
                  onChange={(e) => toggle(role, e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-purple-600"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isEnabled ? 'text-purple-900' : 'text-gray-700'}`}>
                    {label}
                  </p>
                  {person ? (
                    <p className="text-xs text-gray-500 truncate">{person.name} · {person.email}</p>
                  ) : (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      No user assigned to this function yet
                    </p>
                  )}
                </div>
                {isEnabled && (
                  <CheckCircle2 className="h-4 w-4 text-purple-500 flex-shrink-0" />
                )}
              </label>
            )
          })}
        </div>

        {error && <p className="px-4 pb-3 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}
