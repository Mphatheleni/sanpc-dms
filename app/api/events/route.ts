import { getSession } from '@/lib/auth'
import { addSubscriber, removeSubscriber } from '@/lib/realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/events
 * Server-Sent Events endpoint — each logged-in client holds one persistent connection.
 * The server pushes events without the client needing to poll or refresh.
 */
export async function GET() {
  const session = await getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()
  // Captured so cancel() can reference the same controller that start() registered
  let ctrl: ReadableStreamDefaultController<Uint8Array>
  let heartbeat: ReturnType<typeof setInterval>

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
      addSubscriber(session.userId, session.role, c)
      // Initial confirmation — lets the client know the connection is live
      c.enqueue(encoder.encode('data: {"type":"CONNECTED"}\n\n'))
      // Keep-alive heartbeat every 25 s (prevents proxies / load balancers from closing idle connections)
      heartbeat = setInterval(() => {
        try { c.enqueue(encoder.encode(': hb\n\n')) }
        catch { clearInterval(heartbeat) }   // stream closed — stop pinging
      }, 25_000)
    },
    cancel() {
      clearInterval(heartbeat)
      removeSubscriber(session.userId, session.role, ctrl)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',   // disable nginx response buffering
    },
  })
}
