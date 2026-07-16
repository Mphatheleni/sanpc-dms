'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, User } from 'lucide-react'

export interface PickableUser {
  id: string
  name: string
  email: string
  role: string
}

interface UserPickerProps {
  users: PickableUser[]
  value: PickableUser | null
  onChange: (user: PickableUser | null) => void
  placeholder?: string
  label?: string
  required?: boolean
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  DOCUMENT_MANAGER: 'DC',
  REVIEWER: 'Reviewer',
  APPROVER: 'Approver',
}

const roleColors: Record<string, string> = {
  ADMIN: '#EF4444',
  DOCUMENT_MANAGER: '#1C3557',
  REVIEWER: '#7C3AED',
  APPROVER: '#16A34A',
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function UserPicker({ users, value, onChange, placeholder = 'Search users…', label, required }: UserPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? users.filter((u) =>
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.email.toLowerCase().includes(query.toLowerCase())
      )
    : users.slice(0, 10)

  function select(u: PickableUser) {
    onChange(u)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setQuery('')
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {value ? (
        // Selected user chip
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: roleColors[value.role] ?? '#6B7280' }}
          >
            {initials(value.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate leading-tight">{value.name}</p>
            <p className="text-[11px] text-gray-400 truncate leading-tight">{value.email}</p>
          </div>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: `${roleColors[value.role]}20`, color: roleColors[value.role] ?? '#6B7280' }}
          >
            {roleLabels[value.role] ?? value.role}
          </span>
          <button
            type="button"
            onClick={clear}
            className="flex-shrink-0 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        // Search input
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-[#1C3557] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1C3557]/10"
          />
        </div>
      )}

      {/* Dropdown */}
      {open && !value && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-400">
              <User className="h-4 w-4" />
              No users found
            </div>
          ) : (
            <ul className="max-h-60 overflow-y-auto divide-y divide-gray-50">
              {filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); select(u) }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ backgroundColor: roleColors[u.role] ?? '#6B7280' }}
                    >
                      {initials(u.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{u.email}</p>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${roleColors[u.role]}20`, color: roleColors[u.role] ?? '#6B7280' }}
                    >
                      {roleLabels[u.role] ?? u.role}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
