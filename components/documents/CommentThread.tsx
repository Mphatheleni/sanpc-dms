'use client'

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import RichTextEditor, { RichTextDisplay } from '@/components/ui/RichTextEditor'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { DocumentComment } from '@/types'

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

interface CommentThreadProps {
  documentId: string
  comments: DocumentComment[]
  onCommentAdded: (comment: DocumentComment) => void
}

export default function CommentThread({ documentId, comments, onCommentAdded }: CommentThreadProps) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(false)

  const isEmpty = !html || html === '' || html === '<br>' || html === '<p><br></p>' || html === '<div><br></div>'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (isEmpty) return
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: html }),
      })
      if (res.ok) {
        const comment = await res.json()
        onCommentAdded(comment)
        setHtml('')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No comments yet. Be the first to comment.</p>
      )}
      {comments.map((c) => {
        const initials = c.author.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
        return (
          <div key={c.id} className="flex gap-3">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarFallback className="text-xs font-semibold text-white" style={{ backgroundColor: '#1C3557' }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-sm font-semibold text-gray-800">{c.author.name}</span>
                <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
              </div>
              <RichTextDisplay html={c.content} />
            </div>
          </div>
        )
      })}
      <form onSubmit={submit} className="flex gap-2 pt-3 border-t border-gray-100 items-end">
        <div className="flex-1">
          <RichTextEditor
            value={html}
            onChange={setHtml}
            placeholder="Add a comment…"
            rows={2}
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isEmpty || loading}
          style={{ backgroundColor: '#1C3557', color: 'white' }}
          className="self-end mb-0.5"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
