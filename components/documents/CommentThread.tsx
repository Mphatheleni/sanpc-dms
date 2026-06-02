'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import Button from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import type { DocumentComment } from '@/types'

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
        <p className="text-sm text-gray-400">No comments yet.</p>
      )}
      {comments.map((c) => (
        <div key={c.id} className="flex gap-3">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-sanpc-navy-light flex items-center justify-center text-sanpc-navy text-xs font-semibold">
            {c.author.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-sm font-medium text-gray-800">{c.author.name}</span>
              <span className="text-xs text-gray-400">{formatDate(c.createdAt)}</span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
          </div>
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-2 pt-2 border-t border-gray-100">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="flex-1"
        />
        <Button type="submit" loading={loading} disabled={!text.trim()} size="sm">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
