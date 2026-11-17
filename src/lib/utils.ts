import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

/** Point Club runs refinement sessions, not sprints: older rooms stored "Sprint 1" or "Session 1"; both show as "Refinement Session 1". */
export const sessionName = (name?: string | null) => (name ?? '').replace(/^\s*(?:sprint|session)\b/i, 'Refinement Session')
