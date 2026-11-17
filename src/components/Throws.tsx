import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../lib/sounds'
import type { RoomApi } from '../lib/useRoom'
import { reactionFor } from '../lib/reactions'

interface Flight { id: number; item: string; x0: number; y0: number; x1: number; y1: number }
const center = (id: string) => {
  const el = document.querySelector(`[data-seat="${id}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 34 }
}

/** Popcorn, tomatoes and roses flying between seats. Everyone sees them. */
export function Throws({ api }: { api: RoomApi }) {
  const [flights, setFlights] = useState<Flight[]>([])
  const [splats, setSplats] = useState<Flight[]>([])
  useEffect(() => api.actions.onEvent((e) => {
    if (e.kind !== 'throw') return
    const a = center(e.from) ?? { x: window.innerWidth / 2, y: window.innerHeight }, b = center(e.to)
    if (!b) return
    const f = { id: Math.random(), item: e.item, x0: a.x, y0: a.y, x1: b.x, y1: b.y }
    sfx.pop()
    setFlights((x) => [...x, f])
    setTimeout(() => {
      setFlights((x) => x.filter((y) => y.id !== f.id)); setSplats((x) => [...x, f]); reactionFor(e.item).sound()
      setTimeout(() => setSplats((x) => x.filter((y) => y.id !== f.id)), 1800)
    }, 700)
  }), [api.actions])
  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      {flights.map((f) => (
        <motion.div key={f.id} className="absolute text-4xl" style={{ left: 0, top: 0 }}
          initial={{ x: f.x0 - 18, y: f.y0 - 18, rotate: 0 }}
          animate={{ x: [f.x0 - 18, (f.x0 + f.x1) / 2 - 18, f.x1 - 18], y: [f.y0 - 18, Math.min(f.y0, f.y1) - 160, f.y1 - 18], rotate: 540 }}
          transition={{ duration: 0.7, ease: 'easeIn' }}>{f.item}</motion.div>
      ))}
      <AnimatePresence>
        {splats.map((f) => (
          <motion.div key={f.id} className="absolute grid place-items-center" style={{ left: f.x1, top: f.y1 }} initial={{ scale: 0.2, x: '-50%', y: '-50%' }} animate={{ scale: [1.5, 1], x: '-50%', y: '-50%' }} exit={{ opacity: 0, y: '-120%' }}>
            <span className="text-5xl" style={f.item === '🍅' ? { transform: 'scaleY(0.6) scaleX(1.4)' } : undefined}>{f.item === '🍅' ? '🍅' : f.item}</span>
            <span data-testid="reaction-word" className="-mt-1 -rotate-6 whitespace-nowrap rounded-md px-2 py-0.5 font-display text-2xl font-black tracking-wide text-white shadow-lg ring-2 ring-white"
              style={{ background: reactionFor(f.item).color }}>{reactionFor(f.item).word}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
