import { motion } from 'framer-motion'
import { castById } from '../lib/cast'

export function Avatar({ character, size = 56, mood = 'idle', dim = false }: { character: string; size?: number; mood?: 'idle' | 'thinking' | 'cheer' | 'shock'; dim?: boolean }) {
  const c = castById(character)
  const anim =
    mood === 'cheer' ? { y: [0, -18, 0, -10, 0], rotate: [0, -8, 8, -4, 0] } :
    mood === 'shock' ? { x: [0, -4, 4, -3, 3, 0] } :
    mood === 'thinking' ? { rotate: [0, -3, 3, 0] } : { y: [0, -2, 0] }
  const dur = mood === 'cheer' ? 0.9 : mood === 'shock' ? 0.4 : mood === 'thinking' ? 2 : 3
  return (
    <motion.div
      animate={anim} transition={{ duration: dur, repeat: mood === 'shock' ? 2 : Infinity, ease: 'easeInOut' }}
      className="grid place-items-center rounded-full border-2 border-white/20 shrink-0"
      style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, ${c.color}, ${c.color}55 70%)`, opacity: dim ? 0.35 : 1, filter: dim ? 'grayscale(1)' : undefined }}
      title={c.name}
    >
      {c.image ? <img src={c.image} alt={c.name} className="w-full h-full rounded-full object-cover" /> : <span style={{ fontSize: size * 0.58, lineHeight: 1 }}>{c.emoji}</span>}
    </motion.div>
  )
}
