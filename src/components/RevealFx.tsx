import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { sfx } from '../lib/sounds'
import type { Outcome } from '../lib/types'

/** Film-leader countdown: 3, 2, 1. */
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/80">
      <motion.div animate={{ opacity: [1, 0.85, 1] }} transition={{ repeat: Infinity, duration: 0.12 }} className="relative w-80 h-80 rounded-full border-[6px] border-screen/80 grid place-items-center bg-neutral-700/60">
        <div className="absolute inset-6 rounded-full border-2 border-screen/50" />
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-screen/50" />
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-screen/50" />
        <motion.div className="absolute inset-0 rounded-full origin-center" style={{ background: 'conic-gradient(rgba(0,0,0,.55) 0deg, transparent 0deg)' }}
          animate={{ background: ['conic-gradient(rgba(0,0,0,.55) 0deg, transparent 0deg)', 'conic-gradient(rgba(0,0,0,.55) 360deg, transparent 360deg)'] }} transition={{ duration: 0.8, repeat: 3, ease: 'linear' }} />
        <motion.span key={n} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative font-display text-[10rem] leading-none text-screen">{n}</motion.span>
      </motion.div>
    </motion.div>
  )
}

const COPY: Record<Exclude<Outcome, 'none'>, { title: string; sub: (p: string) => string; color: string }> = {
  blockbuster: { title: 'BLOCKBUSTER!', sub: (p) => `Everyone agrees: ${p} points`, color: '#ffd166' },
  critics: { title: "CRITICS' CHOICE", sub: (p) => `Close call. Crowd pick: ${p}`, color: '#ffe8a3' },
  plottwist: { title: 'PLOT TWIST!', sub: () => 'High and low voters: defend your take', color: '#ff6b81' },
}

export function Verdict({ outcome, points }: { outcome: Outcome; points: string }) {
  if (outcome === 'none') return null
  const c = COPY[outcome]
  return (
    <motion.div className="fixed inset-0 z-40 grid place-items-center pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={{ scale: 3, rotate: -8 }} animate={{ scale: 1, rotate: outcome === 'plottwist' ? [-3, 3, -2, 0] : -3 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="text-center">
        <div className="font-display text-8xl drop-shadow-[0_6px_0_rgba(0,0,0,.6)]" style={{ color: c.color, WebkitTextStroke: '3px #1f0a10' }}>{c.title}</div>
        <div className="mt-2 inline-block bg-black/70 rounded-full px-5 py-2 text-xl font-semibold">{c.sub(points)}</div>
      </motion.div>
    </motion.div>
  )
}
