'use client'

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
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
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim() }),
      })
      if (res.ok) {
        const comment = await res.json()
        onCommentAdded(comment)
        setText('')
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
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
            </div>
          </div>
        )
      })}
      <form onSubmit={submit} className="flex gap-2 pt-3 border-t border-gray-100">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="flex-1 resize-none text-sm"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!text.trim() || loading}
          style={{ backgroundColor: '#1C3557', color: 'white' }}
          className="self-end"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
