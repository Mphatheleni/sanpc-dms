'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'

const MAX_WORKFLOW_MEMBERS = 8

interface WorkflowMember {
  userId: string
  name: string
  email: string
  order: number
}

interface MetadataEntry {
  key: string
  value: string
}

interface UserOption {
  id: string
  name: string
  email: string
  role: string
}

export default function UploadForm({ users }: { users: UserOption[] }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Step 1: File
  const [file, setFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    storedName: string; fileName: string; fileType: string; fileSize: number
    sharePointUrl?: string | null; sharePointItemId?: string | null
  } | null>(null)

  // Step 2: Metadata
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [metadata, setMetadata] = useState<MetadataEntry[]>([])

  // Step 3: Workflow
  const [reviewers, setReviewers] = useState<WorkflowMember[]>([])
  const [approvers, setApprovers] = useState<WorkflowMember[]>([])
  const [reviewDeadlineDays, setReviewDeadlineDays] = useState<string>('')

  const reviewerUsers = users.filter((u) => u.role === 'REVIEWER' || u.role === 'ADMIN')
  const approverUsers = users.filter((u) => u.role === 'APPROVER' || u.role === 'ADMIN')

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }, [])

  async function uploadFile() {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setUploadResult({
          storedName: data.storedName,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          sharePointUrl: data.sharePointUrl ?? null,
          sharePointItemId: data.sharePointItemId ?? null,
        })
        if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
        setStep(2)
      }
    } finally {
      setUploading(false)
    }
  }

  function addMember(
    userId: string,
    list: WorkflowMember[],
    setList: React.Dispatch<React.SetStateAction<WorkflowMember[]>>,
    pool: UserOption[],
  ) {
    if (list.length >= MAX_WORKFLOW_MEMBERS) return
    const user = pool.find((u) => u.id === userId)
    if (!user || list.find((m) => m.userId === userId)) return
    setList((prev) => [...prev, { userId, name: user.name, email: user.email, order: prev.length + 1 }])
  }

  function removeMember(
    userId: string,
    setList: React.Dispatch<React.SetStateAction<WorkflowMember[]>>,
  ) {
    setList((prev) =>
      prev.filter((m) => m.userId !== userId).map((m, i) => ({ ...m, order: i + 1 }))
    )
  }

  function moveMember(
    userId: string,
    direction: 'up' | 'down',
    setList: React.Dispatch<React.SetStateAction<WorkflowMember[]>>,
  ) {
    setList((prev) => {
      const idx = prev.findIndex((m) => m.userId === userId)
      if (idx === -1) return prev
      const next = direction === 'up' ? idx - 1 : idx + 1
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr.map((m, i) => ({ ...m, order: i + 1 }))
    })
  }

  function addMetadata() {
    setMetadata((prev) => [...prev, { key: '', value: '' }])
  }

  function updateMetadata(index: number, field: 'key' | 'value', value: string) {
    setMetadata((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)))
  }

  function removeMetadata(index: number) {
    setMetadata((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!uploadResult || !title) return
    if (reviewers.length === 0 && approvers.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...uploadResult,
          title,
          description,
          category,
          tags,
          reviewDeadlineDays: reviewDeadlineDays ? Number(reviewDeadlineDays) : null,
          reviewers: reviewers.map((r) => ({ userId: r.userId, order: r.order })),
          approvers: approvers.map((a) => ({ userId: a.userId, order: a.order })),
          metadata: metadata.filter((m) => m.key && m.value),
        }),
      })
      if (res.ok) {
        const doc = await res.json()
        router.push(`/documents/${doc.id}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Reusable member list UI
  function MemberList({
    label,
    sublabel,
    members,
    pool,
    setList,
    emptyText,
  }: {
    label: string
    sublabel: string
    members: WorkflowMember[]
    pool: UserOption[]
    setList: React.Dispatch<React.SetStateAction<WorkflowMember[]>>
    emptyText: string
  }) {
    const available = pool.filter((u) => !members.find((m) => m.userId === u.id))
    const atMax = members.length >= MAX_WORKFLOW_MEMBERS
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <span className="text-xs text-gray-400">{members.length}/{MAX_WORKFLOW_MEMBERS}</span>
        </div>
        <p className="text-xs text-gray-400 mb-2">{sublabel}</p>
        <div className="mb-2">
          <select
            className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy ${atMax ? 'opacity-50 cursor-not-allowed' : ''}`}
            onChange={(e) => { addMember(e.target.value, members, setList, pool); e.target.value = '' }}
            defaultValue=""
            disabled={atMax}
          >
            <option value="" disabled>{atMax ? `Maximum ${MAX_WORKFLOW_MEMBERS} reached` : `Add ${label.toLowerCase()}…`}</option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{emptyText}</p>
        ) : (
          <div className="space-y-1.5">
            {members.map((m, i) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => moveMember(m.userId, 'up', setList)}
                    disabled={i === 0}
                    className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMember(m.userId, 'down', setList)}
                    disabled={i === members.length - 1}
                    className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <span
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: '#1C3557' }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-700">{m.name}</span>
                <span className="text-xs text-gray-400 hidden sm:block">{m.email}</span>
                <button
                  type="button"
                  onClick={() => removeMember(m.userId, setList)}
                  className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const canProceed = reviewers.length > 0 || approvers.length > 0

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {['File', 'Details', 'Workflow'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                step > i + 1
                  ? 'bg-green-500 text-white'
                  : step === i + 1
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
              style={step === i + 1 ? { backgroundColor: '#1C3557' } : undefined}
            >
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`text-sm font-medium ${step === i + 1 ? 'text-gray-800' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < 2 && <div className="h-px w-8 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: File upload */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Upload Document</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors ${
              dragOver ? 'border-sanpc-amber bg-sanpc-amber-light' : 'border-gray-300 hover:border-sanpc-amber hover:bg-gray-50'
            }`}
          >
            <Upload className="h-10 w-10 text-gray-400 mb-3" />
            {file ? (
              <div className="text-center">
                <p className="font-medium text-gray-700">{file.name}</p>
                <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <>
                <p className="font-medium text-gray-600">Drop a file here or click to browse</p>
                <p className="text-sm text-gray-400 mt-1">Any file type supported</p>
              </>
            )}
            <input
              id="file-input"
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={uploadFile} loading={uploading} disabled={!file} className="w-full">
            Upload & Continue
          </Button>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Document Details</h2>
          <Input label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
              >
                <option value="">— Select category —</option>
                <option>POLICIES AND PROCEDURES</option>
                <option>STANDARD OPERATING PROCEDURES</option>
                <option>WORK INSTRUCTIONS</option>
                <option>FORMS AND TEMPLATES</option>
                <option>REPORTS</option>
                <option>CONTRACTS AND AGREEMENTS</option>
                <option>TECHNICAL DOCUMENTS</option>
                <option>CORRESPONDENCE</option>
                <option>OTHER</option>
              </select>
            </div>
            <Input label="Tags (comma-separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Custom Metadata</label>
              <Button variant="ghost" size="sm" onClick={addMetadata}>
                <Plus className="h-4 w-4" /> Add Field
              </Button>
            </div>
            {metadata.map((m, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input placeholder="Key" value={m.key} onChange={(e) => updateMetadata(i, 'key', e.target.value)} />
                <Input placeholder="Value" value={m.value} onChange={(e) => updateMetadata(i, 'value', e.target.value)} />
                <Button variant="ghost" size="sm" onClick={() => removeMetadata(i)}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={!title}>Continue</Button>
          </div>
        </div>
      )}

      {/* Step 3: Workflow */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Review Workflow</h2>
            <p className="text-sm text-gray-500 mt-1">
              All reviewers receive the document at the same time. Once all approve, it moves to approvers.
            </p>
          </div>

          {/* Review Deadline */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-0.5">Review deadline (days)</label>
              <p className="text-xs text-gray-500">Number of calendar days from submission for reviewers and approvers to complete their review. Leave blank for no deadline.</p>
            </div>
            <input
              type="number"
              min="1"
              max="365"
              value={reviewDeadlineDays}
              onChange={(e) => setReviewDeadlineDays(e.target.value)}
              placeholder="e.g. 5"
              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm text-center font-semibold focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
            />
          </div>

          {/* Reviewers */}
          <div className="rounded-xl border border-gray-200 p-4 space-y-0">
            <MemberList
              label="Reviewers"
              sublabel="All reviewers receive the document simultaneously. Use arrows to set display order."
              members={reviewers}
              pool={reviewerUsers}
              setList={setReviewers}
              emptyText="No reviewers — document goes straight to approvers."
            />
          </div>

          {/* Approvers */}
          <div className="rounded-xl border border-gray-200 p-4">
            <MemberList
              label="Approvers"
              sublabel="All approvers are notified simultaneously once all reviewers have approved."
              members={approvers}
              pool={approverUsers}
              setList={setApprovers}
              emptyText="No approvers — document is complete after all reviewers approve."
            />
          </div>

          {!canProceed && (
            <p className="text-sm text-red-500">Add at least one reviewer or approver to continue.</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!canProceed}>
              Create Document
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
