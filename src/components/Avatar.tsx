import { useState } from 'react'
import { motion } from 'framer-motion'
import { castById } from '../lib/cast'

/** Portrait in a coloured ring. Until real portraits exist, a lit silhouette stands in. */
export function Avatar({ character, name, size = 56, mood = 'idle', dim = false }: { character: string; name?: string; size?: number; mood?: 'idle' | 'thinking' | 'cheer' | 'shock'; dim?: boolean }) {
  const c = castById(character)
  const [broken, setBroken] = useState(false)
  const anim =
    mood === 'cheer' ? { y: [0, -12, 0, -6, 0] } :
    mood === 'shock' ? { x: [0, -4, 4, -3, 3, 0] } :
    mood === 'thinking' ? { scale: [1, 1.02, 1] } : {}
  const dur = mood === 'cheer' ? 0.8 : mood === 'shock' ? 0.4 : 2.4
  return (
    <motion.div animate={anim} transition={{ duration: dur, repeat: mood === 'shock' ? 2 : mood === 'idle' ? 0 : Infinity, ease: 'easeInOut' }}
      className="relative rounded-full shrink-0 p-[3px] shadow-md"
      style={{ width: size, height: size, background: c.color, opacity: dim ? 0.35 : 1, filter: dim ? 'grayscale(1)' : undefined }} title={`${c.name} · ${c.role}`}>
      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white" >
        {c.image && !broken ? <img src={c.image} alt={c.name} className="w-full h-full object-cover" onError={() => setBroken(true)} /> : (
          <div className="w-full h-full grid place-items-center font-semibold tracking-tight text-white" style={{ background: `linear-gradient(145deg, ${c.color}, ${c.color}bb)`, fontSize: size * 0.36 }}>
            {initials(name ?? c.name)}
          </div>
        )}
      </div>
    </motion.div>
  )
}

const initials = (n: string) => n.replace(/^The\s+/i, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
