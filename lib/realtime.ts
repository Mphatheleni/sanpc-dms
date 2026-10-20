/**
 * In-memory SSE event bus for real-time push notifications.
 *
 * Works correctly on single-instance deployments (Cloud Run with min-instances ≥ 1).
 * For multi-instance scale-out, replace broadcastAll / emitToUser / emitToRole
 * with Redis pub/sub and stream each message from there.
 */

export type RealtimeEvent =
  | { type: 'CONNECTED' }
  | { type: 'ROLE_CHANGED'; role: string; label: string }
  | { type: 'DOC_CREATED'; docId: string; title: string }
  | { type: 'DOC_STATUS_CHANGED'; docId: string; title: string; status: string }
  | { type: 'REVIEW_ASSIGNED'; docId: string; title: string }

type Ctrl = ReadableStreamDefaultController<Uint8Array>

// userId  → set of controllers (one per open tab)
const byUser = new Map<string, Set<Ctrl>>()
// role    → set of controllers
const byRole = new Map<string, Set<Ctrl>>()

const enc = new TextEncoder()
function sse(event: RealtimeEvent): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(event)}\n\n`)
}

function safeEnqueue(ctrl: Ctrl, data: Uint8Array) {
  try { ctrl.enqueue(data) } catch { /* stream already closed */ }
}

export function addSubscriber(userId: string, role: string, ctrl: Ctrl) {
  if (!byUser.has(userId)) byUser.set(userId, new Set())
  byUser.get(userId)!.add(ctrl)
  if (!byRole.has(role)) byRole.set(role, new Set())
  byRole.get(role)!.add(ctrl)
}

export function removeSubscriber(userId: string, role: string, ctrl: Ctrl) {
  byUser.get(userId)?.delete(ctrl)
  if (byUser.get(userId)?.size === 0) byUser.delete(userId)
  byRole.get(role)?.delete(ctrl)
  if (byRole.get(role)?.size === 0) byRole.delete(role)
}

/** Push an event to one specific user (all their open tabs). */
export function emitToUser(userId: string, event: RealtimeEvent) {
  const data = sse(event)
  byUser.get(userId)?.forEach((ctrl) => safeEnqueue(ctrl, data))
}

/** Push an event to all users currently holding a given role. */
export function emitToRole(role: string, event: RealtimeEvent) {
  const data = sse(event)
  byRole.get(role)?.forEach((ctrl) => safeEnqueue(ctrl, data))
}

/** Push an event to every connected client. */
export function emitAll(event: RealtimeEvent) {
  const data = sse(event)
  const seen = new Set<Ctrl>()
  byUser.forEach((ctrls) =>
    ctrls.forEach((ctrl) => {
      if (!seen.has(ctrl)) { seen.add(ctrl); safeEnqueue(ctrl, data) }
    }),
  )
}

// ── Convenience helpers ────────────────────────────────────────────────────

export function emitDocStatusChange(docId: string, title: string, status: string) {
  emitAll({ type: 'DOC_STATUS_CHANGED', docId, title, status })
}

export function emitDocCreated(docId: string, title: string) {
  emitToRole('ADMIN', { type: 'DOC_CREATED', docId, title })
  emitToRole('DOCUMENT_MANAGER', { type: 'DOC_CREATED', docId, title })
}

export function emitReviewAssigned(userId: string, docId: string, title: string) {
  emitToUser(userId, { type: 'REVIEW_ASSIGNED', docId, title })
}
