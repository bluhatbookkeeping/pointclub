import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { sfx } from '../lib/sounds'
import type { Outcome } from '../lib/types'

/** Letterbox bars slide in, then a big 3 · 2 · 1 over a light flash. */
export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3)
  const done = useRef(onDone); done.current = onDone
  useEffect(() => {
    sfx.whir(); sfx.beep()
    const t1 = setTimeout(() => { setN(2); sfx.beep() }, 800)
    const t2 = setTimeout(() => { setN(1); sfx.beep(true) }, 1600)
    const t3 = setTimeout(() => done.current(), 2400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-white/60 backdrop-blur-sm">
      <motion.div className="absolute top-0 left-0 right-0 bg-ink" initial={{ height: 0 }} animate={{ height: '11vh' }} />
      <motion.div className="absolute bottom-0 left-0 right-0 bg-ink" initial={{ height: 0 }} animate={{ height: '11vh' }} />
      <div className="text-center">
        <div className="label !text-ink/60">Cards on the table in</div>
        <motion.div key={n} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-[11rem] font-bold leading-none text-ink">{n}</motion.div>
      </div>
    </motion.div>
  )
}

const COPY: Record<Exclude<Outcome, 'none'>, { title: string; sub: (p: string) => string; color: string; rotate: number }> = {
  blockbuster: { title: 'AGREED', sub: (p) => `Everyone picked ${p}`, color: '#12B886', rotate: -4 },
  critics: { title: 'CLOSE', sub: (p) => `Most picked ${p}`, color: '#2F6BFF', rotate: -3 },
  plottwist: { title: 'SPLIT VOTE', sub: () => 'Highest and lowest: explain your vote', color: '#E03131', rotate: -8 },
}

export function Verdict({ outcome, points }: { outcome: Outcome; points: string }) {
  if (outcome === 'none') return null
  const c = COPY[outcome]
  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={{ scale: 2.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, rotate: c.rotate }} transition={{ type: 'spring', stiffness: 380, damping: 18 }} className="text-center">
        <div className="stamp font-display font-bold text-8xl tracking-wide bg-white/80" style={{ color: c.color }}>{c.title}</div>
        <div className="mt-4 inline-block bg-ink text-white rounded-md px-5 py-2 text-lg font-semibold uppercase tracking-wider">{c.sub(points)}</div>
      </motion.div>
    </motion.div>
  )
}

/** End-of-meeting moment: every story is pointed or skipped. */
export function Celebration({ points, stories, skipped, onClose }: { points: number; stories: number; skipped: number; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 7000); return () => clearTimeout(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center bg-white/70 backdrop-blur-sm cursor-pointer" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={{ scale: 0.6, y: 40 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        className="rounded-2xl border bg-background px-12 py-10 text-center shadow-2xl">
        <motion.div className="text-6xl" animate={{ rotate: [0, -12, 12, -8, 8, 0] }} transition={{ duration: 1.2, delay: 0.3 }}>🎉</motion.div>
        <div className="mt-3 text-4xl font-semibold tracking-tight">Great job, team!</div>
        <div className="mt-1 text-lg text-muted-foreground">See you next week.</div>
        <div className="mt-6 flex justify-center gap-8">
          <div><div className="text-3xl font-semibold tabular-nums">{points}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">points</div></div>
          <div><div className="text-3xl font-semibold tabular-nums">{stories}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">stories pointed</div></div>
          {skipped > 0 && <div><div className="text-3xl font-semibold tabular-nums text-amber-700">{skipped}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">for next week</div></div>}
        </div>
        <div className="mt-6 text-xs text-muted-foreground">Click anywhere to close</div>
      </motion.div>
    </motion.div>
  )
}
