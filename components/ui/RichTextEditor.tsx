'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Maximize2, Bold, Italic, Underline, List, ListOrdered, X, Highlighter } from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  rows?: number
  label?: string
  required?: boolean
  className?: string
}

// Sanitise display HTML (client-side only using browser's built-in parser)
function sanitiseHtml(html: string): string {
  if (typeof window === 'undefined') return html
  // Use DOMParser to strip dangerous tags/attributes
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // Remove script/style tags
  doc.querySelectorAll('script,style,iframe,object,embed,form').forEach((el) => el.remove())
  // Strip event handlers
  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
    })
  })
  return doc.body.innerHTML
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Add a comment…',
  rows = 3,
  label,
  required,
  className = '',
}: RichTextEditorProps) {
  const [expanded, setExpanded] = useState(false)
  const compactRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef<HTMLDivElement>(null)
  const isFocused = useRef(false)

  // Sync external value → compact editor when not focused
  useEffect(() => {
    if (compactRef.current && !isFocused.current) {
      if (compactRef.current.innerHTML !== value) {
        compactRef.current.innerHTML = value
      }
    }
  }, [value])

  const handleCompactInput = useCallback(() => {
    if (compactRef.current) {
      onChange(compactRef.current.innerHTML)
    }
  }, [onChange])

  const handleExpandedInput = useCallback(() => {
    if (expandedRef.current) {
      const html = expandedRef.current.innerHTML
      onChange(html)
    }
  }, [onChange])

  function exec(command: string, val?: string) {
    expandedRef.current?.focus()
    document.execCommand(command, false, val)
    handleExpandedInput()
  }

  function openExpanded() {
    setExpanded(true)
    setTimeout(() => {
      if (expandedRef.current) {
        expandedRef.current.innerHTML = value
        // place cursor at end
        const range = document.createRange()
        const sel = window.getSelection()
        range.selectNodeContents(expandedRef.current)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
        expandedRef.current.focus()
      }
    }, 30)
  }

  function closeExpanded() {
    setExpanded(false)
    // Sync back to compact view
    setTimeout(() => {
      if (compactRef.current) {
        compactRef.current.innerHTML = value
      }
    }, 10)
  }

  const isEmpty = !value || value === '' || value === '<br>' || value === '<p><br></p>' || value === '<div><br></div>'
  const minHeight = `${rows * 1.5}rem`

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-gray-600">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Compact editor */}
      <div className="relative rounded-lg border border-gray-300 focus-within:border-[#1C3557] focus-within:ring-2 focus-within:ring-[#1C3557]/10 transition-colors bg-white">
        {isEmpty && (
          <span className="absolute top-2.5 left-3 text-sm text-gray-400 pointer-events-none select-none">
            {placeholder}
          </span>
        )}
        <div
          ref={compactRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleCompactInput}
          onFocus={() => { isFocused.current = true }}
          onBlur={() => { isFocused.current = false }}
          className="px-3 py-2.5 text-sm text-gray-900 outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 leading-relaxed"
          style={{ minHeight, maxHeight: '8rem', overflowY: 'auto' }}
          dangerouslySetInnerHTML={{ __html: value || '' }}
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); openExpanded() }}
          className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-400 hover:text-[#1C3557] hover:bg-gray-100 transition-colors"
          title="Expand editor with formatting options"
        >
          <Maximize2 className="h-3 w-3" />
          Expand
        </button>
      </div>

      {/* Expanded modal */}
      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) closeExpanded() }}>
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>

            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-2.5 border-b border-gray-200 bg-gray-50 flex-wrap">
              {label && <span className="text-sm font-semibold text-gray-700 mr-2">{label}</span>}
              <div className="flex items-center gap-0.5 flex-wrap">
                <ToolbarBtn title="Bold (Ctrl+B)" onMouseDown={() => exec('bold')}>
                  <Bold className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Italic (Ctrl+I)" onMouseDown={() => exec('italic')}>
                  <Italic className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Underline (Ctrl+U)" onMouseDown={() => exec('underline')}>
                  <Underline className="h-4 w-4" />
                </ToolbarBtn>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <ToolbarBtn title="Highlight" onMouseDown={() => exec('hiliteColor', '#FEF08A')}>
                  <span className="flex items-center gap-0.5">
                    <Highlighter className="h-3.5 w-3.5" />
                  </span>
                </ToolbarBtn>
                <ToolbarBtn title="Remove highlight" onMouseDown={() => exec('hiliteColor', 'transparent')}>
                  <span className="text-[10px] font-bold line-through text-gray-500">HL</span>
                </ToolbarBtn>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <ToolbarBtn title="Bullet list" onMouseDown={() => exec('insertUnorderedList')}>
                  <List className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn title="Numbered list" onMouseDown={() => exec('insertOrderedList')}>
                  <ListOrdered className="h-4 w-4" />
                </ToolbarBtn>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <ToolbarBtn title="Clear formatting" onMouseDown={() => exec('removeFormat')}>
                  <span className="text-[10px] font-bold text-gray-500">Tx</span>
                </ToolbarBtn>
              </div>
              <button
                type="button"
                onClick={closeExpanded}
                className="ml-auto rounded p-1 hover:bg-gray-200 transition-colors"
                title="Close"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>

            {/* Editor area */}
            <div
              ref={expandedRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleExpandedInput}
              data-placeholder={placeholder}
              className="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-900 outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 leading-relaxed"
              style={{ minHeight: '240px' }}
            />

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <p className="text-[11px] text-gray-400">Select text to apply formatting • Ctrl+B Bold • Ctrl+I Italic</p>
              <button
                type="button"
                onClick={closeExpanded}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: '#1C3557' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolbarBtn({ children, title, onMouseDown }: {
  children: React.ReactNode
  title: string
  onMouseDown: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onMouseDown() }}
      className="rounded p-1.5 hover:bg-gray-200 transition-colors text-gray-600"
    >
      {children}
    </button>
  )
}

// Helper to render rich text HTML safely
export function RichTextDisplay({ html, className = '' }: { html: string; className?: string }) {
  const [safe, setSafe] = useState('')
  useEffect(() => {
    setSafe(sanitiseHtml(html))
  }, [html])
  return (
    <div
      className={`text-sm text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 leading-relaxed whitespace-pre-wrap ${className}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
