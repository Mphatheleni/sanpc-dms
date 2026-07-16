'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Plus, Trash2, GripVertical, Wand2, ShieldCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import UserPicker, { type PickableUser } from '@/components/ui/UserPicker'

// SANPC document types per CSS/PR/CSF/005
const SANPC_DOC_TYPES = [
  { code: 'PO',  label: 'Policy' },
  { code: 'PR',  label: 'Procedure' },
  { code: 'WP',  label: 'Work Practice' },
  { code: 'WI',  label: 'Work Instruction' },
  { code: 'ST',  label: 'Strategy & Planning' },
  { code: 'RM',  label: 'Risk Matrix' },
  { code: 'SD',  label: 'Standard' },
  { code: 'GL',  label: 'Guidelines' },
  { code: 'TR',  label: 'Training Material' },
  { code: 'TS',  label: 'Test Script' },
  { code: 'PF',  label: 'Process Flow' },
  { code: 'F',   label: 'Form / Template' },
  { code: 'COG', label: 'Corporate Governance' },
  { code: 'SP',  label: 'Internal Specification' },
  { code: 'BC',  label: 'Business Continuity Plan' },
  { code: 'TOR', label: 'Terms of Reference' },
  { code: 'MSM', label: 'Management System Manual' },
]

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
  departmentRole?: string
}

interface MandatoryFunctionConfig {
  id: string
  documentType: string
  deptRole: string
  deptLabel: string
  user: { id: string; name: string; email: string; role: string } | null
}

export default function UploadForm({ users }: { users: UserOption[] }) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [fileError, setFileError] = useState('')

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
  // SANPC fields
  const [subjectCode, setSubjectCode] = useState('')
  const [unitCode, setUnitCode] = useState('')
  const [sequentialNo, setSequentialNo] = useState('')
  const [suggestedNo, setSuggestedNo] = useState<string | null>(null)
  const [revision, setRevision] = useState('00')
  const [originator, setOriginator] = useState('')
  const [authorisedBy, setAuthorisedBy] = useState('')
  const [purpose, setPurpose] = useState('')
  const [originatorUser, setOriginatorUser] = useState<PickableUser | null>(null)
  const [authorizerUser, setAuthorizerUser] = useState<PickableUser | null>(null)

  // Step 3: Workflow
  const [reviewers, setReviewers] = useState<WorkflowMember[]>([])
  const [approvers, setApprovers] = useState<WorkflowMember[]>([])
  const [reviewDeadlineDays, setReviewDeadlineDays] = useState<string>('')
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Mandatory reviewers — function-based, auto-loaded per document type
  const [mandatoryFunctions, setMandatoryFunctions] = useState<MandatoryFunctionConfig[]>([])
  const [loadingMandatory, setLoadingMandatory] = useState(false)
  // Roles manually unticked by the Document Controller for this specific document
  const [uncheckedRoles, setUncheckedRoles] = useState<Set<string>>(new Set())

  // IDs of users that are currently auto-included as mandatory
  const allMandatoryUserIds = new Set(
    mandatoryFunctions.filter((f) => f.user).map((f) => f.user!.id)
  )

  const reviewerUsers = users.filter((u) => u.role === 'REVIEWER' || u.role === 'ADMIN')
  const approverUsers = users.filter((u) => u.role === 'APPROVER' || u.role === 'ADMIN')
  const docTypeCode = SANPC_DOC_TYPES.find((t) => t.label === category)?.code ?? ''
  const dragItemRef = useRef<string | null>(null)
  const dragOverRef = useRef<string | null>(null)

  // Auto-suggest next sequential number when subject/type/unit are all filled
  useEffect(() => {
    const code = SANPC_DOC_TYPES.find((t) => t.label === category)?.code ?? ''
    if (!subjectCode || !code || !unitCode) { setSuggestedNo(null); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/documents/next-number?subject=${encodeURIComponent(subjectCode)}&type=${encodeURIComponent(code)}&unit=${encodeURIComponent(unitCode)}`
        )
        if (res.ok) setSuggestedNo((await res.json()).nextNumber)
      } catch { /* ignore */ }
    }, 400)
    return () => clearTimeout(timer)
  }, [subjectCode, category, unitCode])

  // Fetch mandatory functions when category changes; clear immediately so sync effect fires
  useEffect(() => {
    setMandatoryFunctions([])
    setUncheckedRoles(new Set())
    if (!category) return
    setLoadingMandatory(true)
    fetch(`/api/mandatory-reviewers?type=${encodeURIComponent(category)}`)
      .then((r) => r.json())
      .then((data) => setMandatoryFunctions(Array.isArray(data) ? data : []))
      .catch(() => setMandatoryFunctions([]))
      .finally(() => setLoadingMandatory(false))
  }, [category])

  // Sync mandatory functions → reviewers whenever functions or unchecked set changes
  useEffect(() => {
    const checkedUsers = mandatoryFunctions
      .filter((f) => !uncheckedRoles.has(f.deptRole) && f.user)
      .map((f) => f.user!)

    setReviewers((prev) => {
      // Keep manually-added reviewers (those not in the full mandatory set)
      const manual = prev.filter((r) => !allMandatoryUserIds.has(r.userId))
      // Add checked mandatory users that aren't already in the list
      const toAdd = checkedUsers.filter((u) => !manual.some((r) => r.userId === u.id))
      const combined = [
        ...manual,
        ...toAdd.map((u, i) => ({
          userId: u.id, name: u.name, email: u.email, order: manual.length + i + 1,
        })),
      ]
      return combined.map((r, i) => ({ ...r, order: i + 1 }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mandatoryFunctions, uncheckedRoles])

  function toggleMandatoryRole(deptRole: string, checked: boolean) {
    setUncheckedRoles((prev) => {
      const next = new Set(prev)
      if (checked) next.delete(deptRole)
      else next.add(deptRole)
      return next
    })
  }

  function handleDragReorder(setList: React.Dispatch<React.SetStateAction<WorkflowMember[]>>) {
    const dragId = dragItemRef.current
    const overId = dragOverRef.current
    if (!dragId || !overId || dragId === overId) return
    setList((prev) => {
      const arr = [...prev]
      const fromIdx = arr.findIndex((m) => m.userId === dragId)
      const toIdx = arr.findIndex((m) => m.userId === overId)
      if (fromIdx === -1 || toIdx === -1) return prev
      const [item] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, item)
      return arr.map((m, i) => ({ ...m, order: i + 1 }))
    })
    dragItemRef.current = null
    dragOverRef.current = null
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }, [])

  async function uploadFile() {
    if (!file) return
    setUploading(true)
    setFileError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setUploadResult({
          storedName: data.storedName, fileName: data.fileName,
          fileType: data.fileType, fileSize: data.fileSize,
          sharePointUrl: data.sharePointUrl ?? null,
          sharePointItemId: data.sharePointItemId ?? null,
        })
        if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''))
        setStep(2)
      } else {
        const err = await res.json().catch(() => ({}))
        const details: string[] = err.details ?? []
        const hasPermission = details.some((d) => d.includes('403') || d.includes('Forbidden') || d.includes('AccessDenied'))
        if (hasPermission) {
          setFileError('SharePoint upload was blocked (403 Forbidden). The DMS app may not have permission to write to the SharePoint document library. Please ask your IT administrator to grant Files.ReadWrite.All on the Azure app registration.')
        } else if (details.length > 0) {
          setFileError(`Upload failed: ${details[0].replace(/^SharePoint:\s*Error:\s*/i, '')}`)
        } else {
          setFileError(err.error || 'Upload failed — please try again.')
        }
      }
    } catch {
      setFileError('Network error — could not reach the server. Please check your connection and try again.')
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
    const user = pool.find((u) => u.id === userId)
    if (!user || list.find((m) => m.userId === userId)) return
    setList((prev) => [...prev, { userId, name: user.name, email: user.email, order: prev.length + 1 }])
  }

  function removeMember(userId: string, setList: React.Dispatch<React.SetStateAction<WorkflowMember[]>>) {
    setList((prev) => prev.filter((m) => m.userId !== userId).map((m, i) => ({ ...m, order: i + 1 })))
  }

  function addMetadata() { setMetadata((prev) => [...prev, { key: '', value: '' }]) }
  function updateMetadata(index: number, field: 'key' | 'value', value: string) {
    setMetadata((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)))
  }
  function removeMetadata(index: number) { setMetadata((prev) => prev.filter((_, i) => i !== index)) }

  async function handleSubmit() {
    if (!uploadResult || !title) return
    if (reviewers.length === 0 && approvers.length === 0) return
    setSubmitting(true)
    setSubmitError('')
    const documentNumber = subjectCode && docTypeCode && unitCode && sequentialNo
      ? `${subjectCode.toUpperCase()}/${docTypeCode}/${unitCode.toUpperCase()}/${sequentialNo}`
      : undefined
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...uploadResult, title, description, category, tags,
          reviewDeadlineDays: reviewDeadlineDays ? Number(reviewDeadlineDays) : null,
          reviewers: reviewers.map((r) => ({ userId: r.userId, order: r.order })),
          approvers: approvers.map((a) => ({ userId: a.userId, order: a.order })),
          metadata: metadata.filter((m) => m.key && m.value),
          documentNumber, documentTypeCode: docTypeCode || undefined,
          revision: revision || '00',
          originator: originatorUser?.name || originator || undefined,
          authorisedBy: authorizerUser?.name || authorisedBy || undefined,
          purpose: purpose || undefined,
          originatorId: originatorUser?.id || undefined,
          authorizerId: authorizerUser?.id || undefined,
        }),
      })
      if (res.ok) {
        router.push(`/documents/${(await res.json()).id}`)
      } else {
        const err = await res.json().catch(() => ({}))
        setSubmitError(err.error || `Server error ${res.status}`)
      }
    } catch {
      setSubmitError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  function MemberList({
    label, sublabel, members, pool, setList, emptyText,
  }: {
    label: string; sublabel: string; members: WorkflowMember[]
    pool: UserOption[]; setList: React.Dispatch<React.SetStateAction<WorkflowMember[]>>; emptyText: string
  }) {
    const available = pool.filter((u) => !members.find((m) => m.userId === u.id))
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <span className="text-xs text-gray-400">{members.length} added</span>
        </div>
        <p className="text-xs text-gray-400 mb-2">{sublabel}</p>
        <div className="mb-2">
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
            onChange={(e) => { addMember(e.target.value, members, setList, pool); e.target.value = '' }}
            defaultValue=""
          >
            <option value="" disabled>{`Add ${label.toLowerCase()}…`}</option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-gray-400 italic">{emptyText}</p>
        ) : (
          <div className="space-y-1.5">
            {members.map((m, i) => {
              const isMandatory = label === 'Reviewers' && allMandatoryUserIds.has(m.userId)
              return (
                <div
                  key={m.userId}
                  draggable={!isMandatory}
                  onDragStart={() => { if (!isMandatory) dragItemRef.current = m.userId }}
                  onDragEnter={() => { dragOverRef.current = m.userId; setDragOverId(m.userId) }}
                  onDragEnd={() => { handleDragReorder(setList); setDragOverId(null) }}
                  onDragOver={(e) => e.preventDefault()}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                    dragOverId === m.userId
                      ? 'border-sanpc-amber bg-amber-50'
                      : isMandatory ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'
                  } ${!isMandatory ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  {isMandatory
                    ? <ShieldCheck className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    : <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  }
                  <span
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: isMandatory ? '#7C3AED' : '#1C3557' }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-700">{m.name}</span>
                  {isMandatory && (
                    <span className="text-[10px] font-semibold text-purple-500 uppercase tracking-wide hidden sm:block">
                      Mandatory
                    </span>
                  )}
                  <span className="text-xs text-gray-400 hidden sm:block">{m.email}</span>
                  {!isMandatory && (
                    <button
                      type="button"
                      onClick={() => removeMember(m.userId, setList)}
                      className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
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
                step > i + 1 ? 'bg-green-500 text-white'
                  : step === i + 1 ? 'text-white' : 'bg-gray-100 text-gray-400'
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

      {/* ── Step 1: File upload ─────────────────────────────────────────── */}
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
            <input id="file-input" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {fileError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {fileError}
            </div>
          )}
          <Button onClick={uploadFile} loading={uploading} disabled={!file} className="w-full">
            Upload & Continue
          </Button>
        </div>
      )}

      {/* ── Step 2: Details ─────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Document Details</h2>
          <Input label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Input
            label="Purpose (one-line statement)"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. To govern the control and management of regulatory documents"
          />
          <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />

          {/* Document Type */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Document Type *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
            >
              <option value="">— Select document type —</option>
              {SANPC_DOC_TYPES.map((t) => (
                <option key={t.code} value={t.label}>{t.label} ({t.code})</option>
              ))}
            </select>
          </div>

          {/* Document Number Builder */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700">Document Number</label>
              {subjectCode && category && unitCode && sequentialNo && (
                <span className="text-xs font-mono font-bold text-sanpc-navy bg-sanpc-navy-light px-2 py-0.5 rounded">
                  {subjectCode.toUpperCase()}/{SANPC_DOC_TYPES.find((t) => t.label === category)?.code ?? '??'}/{unitCode.toUpperCase()}/{sequentialNo}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">Format: SUBJECT / TYPE / UNIT / NUMBER (e.g. CSS/PR/CSF/005)</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Subject Code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value.toUpperCase())} placeholder="e.g. CSS" />
              <Input label="Unit Code" value={unitCode} onChange={(e) => setUnitCode(e.target.value.toUpperCase())} placeholder="e.g. CSF" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sequential No.</label>
                <div className="flex gap-1.5">
                  <input
                    type="text" value={sequentialNo} onChange={(e) => setSequentialNo(e.target.value)} placeholder="e.g. 005"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
                  />
                  {suggestedNo && (
                    <button type="button" title={`Use suggested: ${suggestedNo}`} onClick={() => setSequentialNo(suggestedNo)}
                      className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <Wand2 className="h-3.5 w-3.5" />{suggestedNo}
                    </button>
                  )}
                </div>
                {suggestedNo && <p className="text-[10px] text-gray-400 mt-0.5">Next available: {suggestedNo}</p>}
              </div>
              <Input label="Revision No." value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="e.g. 00" />
            </div>
          </div>

          {/* People */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <UserPicker users={users} value={originatorUser}
              onChange={(u) => { setOriginatorUser(u); if (u) setOriginator(u.name) }}
              label="Originator" placeholder="Search by name or email…" />
            <UserPicker users={users} value={authorizerUser}
              onChange={(u) => { setAuthorizerUser(u); if (u) setAuthorisedBy(u.name) }}
              label="Authorised By" placeholder="Search by name or email…" />
          </div>

          {/* Tags — FR-2.1/2.2 */}
          <div className="space-y-1">
            <Input
              label="Tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. incentives policy, PPE, framework, risk"
            />
            <p className="text-xs text-gray-400">
              Comma-separated keywords used to search for this document — tag the subject, document type, and key themes.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Custom Metadata</label>
              <Button variant="ghost" size="sm" onClick={addMetadata}><Plus className="h-4 w-4" /> Add Field</Button>
            </div>
            {metadata.map((m, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input placeholder="Key" value={m.key} onChange={(e) => updateMetadata(i, 'key', e.target.value)} />
                <Input placeholder="Value" value={m.value} onChange={(e) => updateMetadata(i, 'value', e.target.value)} />
                <Button variant="ghost" size="sm" onClick={() => removeMetadata(i)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={!title}>Continue</Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Workflow ─────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Review Workflow</h2>
            <p className="text-sm text-gray-500 mt-1">
              All reviewers receive the document at the same time. Once all approve, it moves to approvers.
            </p>
          </div>

          {/* ── Mandatory reviewers panel (FR-3.1, 3.3) ──────────────────── */}
          {category && (loadingMandatory || mandatoryFunctions.length > 0) && (
            <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-purple-700" />
                <p className="text-sm font-semibold text-purple-800">
                  Mandatory Reviewers — {category}
                </p>
              </div>
              <p className="text-xs text-purple-600">
                These functions are required reviewers for {category} documents and have been automatically added below.
                Untick any that don&apos;t apply to this specific document.
              </p>

              {loadingMandatory ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-purple-100" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {mandatoryFunctions.map((fn) => {
                    const isChecked = !uncheckedRoles.has(fn.deptRole)
                    return (
                      <label
                        key={fn.id}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all ${
                          isChecked ? 'border-purple-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => toggleMandatoryRole(fn.deptRole, e.target.checked)}
                          className="h-4 w-4 rounded accent-purple-600 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-purple-500">{fn.deptLabel}</p>
                          {fn.user ? (
                            <p className="text-sm font-medium text-gray-800">{fn.user.name}</p>
                          ) : (
                            <p className="text-xs text-amber-600">⚠ No user assigned to this function — configure in Admin</p>
                          )}
                        </div>
                        {isChecked && fn.user && (
                          <span className="text-[10px] font-semibold text-green-600 flex-shrink-0">Added ✓</span>
                        )}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Review Deadline — FR-4.1 */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-0.5">Review deadline (working days)</label>
              <p className="text-xs text-gray-500">
                Number of working days from submission for reviewers and approvers to respond. Leave blank for no deadline.
              </p>
            </div>
            <input
              type="number" min="1" max="365" value={reviewDeadlineDays}
              onChange={(e) => setReviewDeadlineDays(e.target.value)} placeholder="e.g. 5"
              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm text-center font-semibold focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
            />
          </div>

          {/* Reviewers */}
          <div className="rounded-xl border border-gray-200 p-4">
            <MemberList
              label="Reviewers"
              sublabel="All reviewers receive the document simultaneously. Drag to reorder. Mandatory reviewers (shown in purple) are managed above."
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
              sublabel="All approvers are notified simultaneously once all reviewers have approved. Drag to reorder."
              members={approvers}
              pool={approverUsers}
              setList={setApprovers}
              emptyText="No approvers — document is complete after all reviewers approve."
            />
          </div>

          {!canProceed && (
            <p className="text-sm text-red-500">Add at least one reviewer or approver to continue.</p>
          )}
          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{submitError}</p>
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
