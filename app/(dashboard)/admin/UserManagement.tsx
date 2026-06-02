'use client'

import { useState } from 'react'
import { Trash2, UserPlus, X, ChevronDown } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'

interface User {
  id: string
  name: string
  email: string
  role: string
  createdAt: Date
  docCount: number
}

const roleVariants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
  ADMIN:            'danger',
  DOCUMENT_MANAGER: 'info',
  REVIEWER:         'secondary',
  APPROVER:         'success',
}

const roleLabels: Record<string, string> = {
  ADMIN:            'Admin',
  DOCUMENT_MANAGER: 'Manager',
  REVIEWER:         'Reviewer',
  APPROVER:         'Approver',
}

const roleColors: Record<string, string> = {
  ADMIN:            '#EF4444',
  DOCUMENT_MANAGER: '#1C3557',
  REVIEWER:         '#7C3AED',
  APPROVER:         '#16A34A',
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ROLES = ['ADMIN', 'DOCUMENT_MANAGER', 'REVIEWER', 'APPROVER'] as const

export default function UserManagement({ initialUsers, currentUserId }: { initialUsers: User[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers)
  const [showAddForm, setShowAddForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)

  // Add user form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<string>('REVIEWER')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAdding(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'Failed to create user'); return }
      setUsers((prev) => [...prev, { ...data, docCount: 0 }])
      setName(''); setEmail(''); setPassword(''); setRole('REVIEWER')
      setShowAddForm(false)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id))
      }
    } finally {
      setDeleting(null)
      setConfirmDelete(null)
    }
  }

  async function handleRoleChange(id: string, newRole: string) {
    setUpdatingRole(id)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: data.role } : u))
      }
    } finally {
      setUpdatingRole(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} registered users</p>
        </div>
        <button
          onClick={() => { setShowAddForm((v) => !v); setAddError('') }}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all shadow-sm hover:shadow-md"
          style={{ backgroundColor: '#1C3557' }}
        >
          {showAddForm ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {showAddForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <Card>
          <h2 className="font-semibold text-gray-800 mb-4">New User</h2>
          <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@sanpc.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              required
              minLength={6}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-sanpc-navy focus:outline-none focus:ring-1 focus:ring-sanpc-navy"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabels[r]}</option>
                ))}
              </select>
            </div>
            {addError && (
              <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 border border-red-200">
                {addError}
              </p>
            )}
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={adding}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#1C3557' }}
              >
                {adding ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Users Table */}
      <Card padding={false}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="px-6 py-3 font-medium text-gray-500">User</th>
              <th className="px-6 py-3 font-medium text-gray-500">Email</th>
              <th className="px-6 py-3 font-medium text-gray-500">Role</th>
              <th className="px-6 py-3 font-medium text-gray-500 text-center">Docs</th>
              <th className="px-6 py-3 font-medium text-gray-500">Joined</th>
              <th className="px-6 py-3 font-medium text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: roleColors[user.role] ?? '#1C3557' }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{user.name}</p>
                      {user.id === currentUserId && (
                        <p className="text-[10px] text-gray-400">You</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-gray-500">{user.email}</td>
                <td className="px-6 py-3">
                  {user.id === currentUserId ? (
                    <Badge variant={roleVariants[user.role] ?? 'default'}>
                      {roleLabels[user.role] ?? user.role}
                    </Badge>
                  ) : (
                    <div className="relative inline-flex items-center gap-1">
                      <select
                        value={user.role}
                        disabled={updatingRole === user.id}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="appearance-none rounded-full py-0.5 pl-2.5 pr-6 text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sanpc-navy cursor-pointer disabled:opacity-50"
                        style={{
                          backgroundColor: roleVariants[user.role] === 'danger' ? '#FEE2E2' :
                            roleVariants[user.role] === 'info' ? '#E8EDF4' :
                            roleVariants[user.role] === 'secondary' ? '#EDE9FE' :
                            roleVariants[user.role] === 'success' ? '#DCFCE7' : '#F3F4F6',
                          color: roleColors[user.role] ?? '#374151',
                        }}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 opacity-50" style={{ color: roleColors[user.role] }} />
                    </div>
                  )}
                </td>
                <td className="px-6 py-3 text-center text-gray-600">{user.docCount}</td>
                <td className="px-6 py-3 text-gray-500">{formatDate(user.createdAt)}</td>
                <td className="px-6 py-3 text-right">
                  {user.id !== currentUserId && (
                    confirmDelete === user.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-500">Delete?</span>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={deleting === user.id}
                          className="rounded px-2 py-1 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleting === user.id ? '…' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="rounded px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(user.id)}
                        className="rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
