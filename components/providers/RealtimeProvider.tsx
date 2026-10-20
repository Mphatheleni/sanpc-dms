'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Props {
  userId: string
  role: string
}

type RealtimeEvent =
  | { type: 'CONNECTED' }
  | { type: 'ROLE_CHANGED'; role: string; label: string }
  | { type: 'DOC_CREATED'; docId: string; title: string }
  | { type: 'DOC_STATUS_CHANGED'; docId: string; title: string; status: string }
  | { type: 'REVIEW_ASSIGNED'; docId: string; title: string }

/**
 * Mounts a persistent SSE connection to /api/events.
 * Renders nothing — all output is toasts + router.refresh() calls.
 *
 * router.refresh() re-runs all server components starting from the root layout.
 * Because getSession() always re-reads the user's role from the DB, the UI
 * immediately reflects role changes without a hard page reload.
 */
export default function RealtimeProvider({ userId, role }: Props) {
  const router = useRouter()

  // Use a ref so event handlers always see the latest role without re-subscribing
  const roleRef = useRef(role)
  roleRef.current = role

  useEffect(() => {
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      es = new EventSource('/api/events')

      es.onmessage = (raw) => {
        try { handle(JSON.parse(raw.data) as RealtimeEvent) }
        catch { /* ignore malformed frames */ }
      }

      es.onerror = () => {
        es?.close()
        es = null
        // Reconnect after 5 s — simple, no exponential backoff needed for internal SSE
        retryTimer = setTimeout(connect, 5_000)
      }
    }

    function handle(event: RealtimeEvent) {
      const currentRole = roleRef.current

      switch (event.type) {
        case 'ROLE_CHANGED':
          toast.success('Your role has been updated', {
            description: `You are now: ${event.label}. The page is refreshing…`,
            duration: 8_000,
          })
          // router.refresh() re-runs server components → getSession() re-reads DB → new role badge appears instantly
          router.refresh()
          break

        case 'DOC_CREATED':
          // Only show a visible toast to admins & document controllers; everyone else silently refreshes
          if (currentRole === 'ADMIN' || currentRole === 'DOCUMENT_MANAGER') {
            toast.info('New document uploaded', {
              description: `"${event.title}" is now available in the system.`,
              duration: 6_000,
            })
          }
          router.refresh()
          break

        case 'DOC_STATUS_CHANGED': {
          const label = event.status.replace(/_/g, ' ')
          if (currentRole === 'ADMIN' || currentRole === 'DOCUMENT_MANAGER') {
            toast.info('Document status changed', {
              description: `"${event.title}" → ${label}`,
              duration: 5_000,
            })
          }
          router.refresh()
          break
        }

        case 'REVIEW_ASSIGNED':
          toast.warning('Action required', {
            description: `You have been assigned to review "${event.title}".`,
            duration: 10_000,
            action: {
              label: 'Open',
              onClick: () => router.push(`/documents/${event.docId}`),
            },
          })
          router.refresh()
          break
      }
    }

    connect()

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      es?.close()
    }
  // Only re-subscribe if the user changes (e.g. different login session in same tab)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return null
}
