import { motion } from 'framer-motion'
import { castById } from '../lib/cast'

/** Portrait in a coloured ring. Until real portraits exist, a lit silhouette stands in. */
export function Avatar({ character, size = 56, mood = 'idle', dim = false }: { character: string; size?: number; mood?: 'idle' | 'thinking' | 'cheer' | 'shock'; dim?: boolean }) {
  const c = castById(character)
  const anim =
    mood === 'cheer' ? { y: [0, -12, 0, -6, 0] } :
    mood === 'shock' ? { x: [0, -4, 4, -3, 3, 0] } :
    mood === 'thinking' ? { scale: [1, 1.02, 1] } : {}
  const dur = mood === 'cheer' ? 0.8 : mood === 'shock' ? 0.4 : 2.4
  return (
    <motion.div animate={anim} transition={{ duration: dur, repeat: mood === 'shock' ? 2 : mood === 'idle' ? 0 : Infinity, ease: 'easeInOut' }}
      className="relative rounded-full shrink-0 p-[3px] shadow-card"
      style={{ width: size, height: size, background: c.color, opacity: dim ? 0.35 : 1, filter: dim ? 'grayscale(1)' : undefined }} title={`${c.name} · ${c.role}`}>
      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white" style={{ background: `radial-gradient(circle at 50% 30%, #ffffff, ${c.color}33 75%)` }}>
        {c.image ? <img src={c.image} alt={c.name} className="w-full h-full object-cover" /> : (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs><linearGradient id={`g-${c.id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2a2c33" /><stop offset="1" stopColor="#17181C" /></linearGradient></defs>
            <circle cx="50" cy="40" r="17" fill={`url(#g-${c.id})`} />
            <path d="M14 100 C16 72 32 62 50 62 C68 62 84 72 86 100 Z" fill={`url(#g-${c.id})`} />
            <path d="M33 34 Q50 22 67 34" stroke={c.color} strokeWidth="3" fill="none" opacity=".9" />
          </svg>
        )}
      </div>
    </motion.div>
  )
}
