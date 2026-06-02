/** Legacy constant — kept for backward compat; prefer per-document deadline field */
export const REVIEW_SLA_HOURS = 48

/** Calculate the deadline DateTime for a review given startedAt + days */
export function calcDeadline(startedAt: Date | string, days: number): Date {
  return new Date(new Date(startedAt).getTime() + days * 24 * 3600 * 1000)
}

/** Is a review overdue based on its explicit deadline field? */
export function isReviewOverdue(startedAt: Date | string | null, deadline?: Date | string | null): boolean {
  if (!startedAt) return false
  if (deadline) return Date.now() > new Date(deadline).getTime()
  // fallback: use legacy SLA_HOURS
  return Date.now() > new Date(startedAt).getTime() + REVIEW_SLA_HOURS * 3600 * 1000
}

/** Human-readable time relative to deadline (e.g. "2d left", "3h overdue") */
export function getDeadlineLabel(deadline: Date | string | null | undefined): string | null {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms < 0) {
    const abs = -ms
    const d = Math.floor(abs / 86400000)
    const h = Math.floor((abs % 86400000) / 3600000)
    return d > 0 ? `${d}d overdue` : `${h}h overdue`
  }
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  if (d > 0) return `${d}d left`
  if (h > 0) return `${h}h left`
  return 'Due today'
}

/** @deprecated use getDeadlineLabel with a deadline field instead */
export function getOverdueDuration(startedAt: Date | string): string {
  const ms = Date.now() - new Date(startedAt).getTime() - REVIEW_SLA_HOURS * 3600 * 1000
  const hours = Math.floor(ms / 3600000)
  if (hours < 24) return `${hours}h overdue`
  return `${Math.floor(hours / 24)}d overdue`
}
