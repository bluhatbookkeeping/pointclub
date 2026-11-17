import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

/** Point Club runs refinement sessions, not sprints: older rooms stored "Sprint 1" or "Session 1"; both show as "Refinement Session 1". */
export const sessionName = (name?: string | null) => (name ?? '').replace(/^\s*(?:sprint|session)\b/i, 'Refinement Session')

/** A calendar date as "YYYY-MM-DD" in the viewer's own time zone. */
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** "YYYY-MM-DD" → a local Date at noon (so no time zone can tip it into the day before or after). */
const fromIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1, 12) }
/** The session's meeting date as YYYY-MM-DD; older sessions without one use the day they started. */
export const sessionIso = (s?: { meetingDate?: string | null; startedAt?: number } | null) =>
  s?.meetingDate && /^\d{4}-\d{2}-\d{2}$/.test(s.meetingDate) ? s.meetingDate : s?.startedAt ? isoDate(new Date(s.startedAt)) : ''
/** "Tue, Nov 24" (or "Tue, Nov 24, 2027" when it isn't this year). */
export function sessionDate(s?: { meetingDate?: string | null; startedAt?: number } | null, short = false): string {
  const iso = sessionIso(s); if (!iso) return ''
  const d = fromIso(iso)
  const opts: Intl.DateTimeFormatOptions = short ? { month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' }
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString(undefined, opts)
}
/** Default date for the next session: a week after this one (or after today, if this one is already past). */
export function nextWeek(s?: { meetingDate?: string | null; startedAt?: number } | null): string {
  const base = sessionIso(s); const today = isoDate(new Date())
  const d = fromIso(base && base > today ? base : today); d.setDate(d.getDate() + 7); return isoDate(d)
}
