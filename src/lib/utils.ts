import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

/** Point Club runs pointing sessions, not sprints: older rooms stored "Sprint 1", which shows as "Session 1". */
export const sessionName = (name?: string | null) => (name ?? '').replace(/^\s*sprint\b/i, 'Session')
