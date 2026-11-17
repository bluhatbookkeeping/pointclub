import { motion } from 'framer-motion'
import type { CardValue } from '../lib/types'

export const label = (v: CardValue | string) => (v === 'coffee' ? '☕' : v)

export function TicketCard({ value, selected, onClick, disabled }: { value: CardValue; selected?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -14, rotate: -2 }} animate={{ y: selected ? -22 : 0 }}
      onClick={onClick} disabled={disabled}
      className={`ticket relative w-16 h-24 rounded-lg font-display text-2xl grid place-items-center transition-colors disabled:opacity-50 ${selected ? 'bg-marquee-400 text-velvet-950 shadow-bulb' : 'bg-screen text-velvet-800 hover:bg-marquee-300'}`}
      aria-pressed={selected} aria-label={`Vote ${value === 'coffee' ? 'coffee break' : value}`}
    >
      <span className="absolute top-1 left-0 right-0 text-[9px] tracking-widest font-body font-bold opacity-60">ADMIT ONE</span>
      {label(value)}
      <span className="absolute bottom-1 left-2 right-2 border-t border-dashed border-current opacity-30" />
    </motion.button>
  )
}

/** Small card that sits under a seat. Face down until the reveal. */
export function SeatCard({ value, faceUp, delay = 0 }: { value: CardValue | null; faceUp: boolean; delay?: number }) {
  if (!value) return <div className="w-10 h-14 rounded-md border-2 border-dashed border-white/20" />
  return (
    <div className="w-10 h-14 [perspective:600px]">
      <motion.div className="relative w-full h-full [transform-style:preserve-3d]" initial={false} animate={{ rotateY: faceUp ? 180 : 0 }} transition={{ duration: 0.5, delay }}>
        <div className="absolute inset-0 rounded-md bg-velvet-600 border-2 border-marquee-400 grid place-items-center [backface-visibility:hidden] text-marquee-400 text-lg">★</div>
        <div className="absolute inset-0 rounded-md bg-screen text-velvet-800 font-display text-xl grid place-items-center [backface-visibility:hidden] [transform:rotateY(180deg)]">{label(value)}</div>
      </motion.div>
    </div>
  )
}
