import { CardValue, NUMERIC, Outcome } from './types'

export interface Result {
  outcome: Outcome
  suggested: string | null
  average: number | null
  counts: Record<string, number>
  low: CardValue | null
  high: CardValue | null
}

export function judge(values: CardValue[]): Result {
  const counts: Record<string, number> = {}
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1
  const nums = values.filter((v) => NUMERIC.includes(v))
  if (nums.length === 0) return { outcome: 'none', suggested: null, average: null, counts, low: null, high: null }
  const idx = nums.map((v) => NUMERIC.indexOf(v))
  const lo = Math.min(...idx)
  const hi = Math.max(...idx)
  const spread = hi - lo
  const outcome: Outcome = spread === 0 ? 'blockbuster' : spread === 1 ? 'critics' : 'plottwist'
  // Most-picked number; ties go to the larger card (safer estimate).
  let suggested = nums[0]
  for (const v of nums) {
    const c = counts[v], best = counts[suggested]
    if (c > best || (c === best && NUMERIC.indexOf(v) > NUMERIC.indexOf(suggested))) suggested = v
  }
  const average = Math.round((nums.reduce((s, v) => s + Number(v), 0) / nums.length) * 10) / 10
  return { outcome, suggested, average, counts, low: NUMERIC[lo], high: NUMERIC[hi] }
}
