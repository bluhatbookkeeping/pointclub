import { motion } from 'framer-motion'
import type { CardValue } from '../lib/types'

export const label = (v: CardValue | string) => (v === 'coffee' ? '☕' : v === 'pass' ? 'Out' : v)
const SUIT = '♠'

/** A real-looking playing card in your hand. */
export function TicketCard({ value, selected, onClick, disabled, color = '#FF5A36' }: { value: CardValue; selected?: boolean; onClick?: () => void; disabled?: boolean; color?: string }) {
  const l = label(value)
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -16, rotate: -2 }} animate={{ y: selected ? -26 : 0 }}
      onClick={onClick} disabled={disabled}
      className="relative w-[72px] h-[104px] rounded-lg bg-white border border-ink/15 shadow-md disabled:opacity-50 text-ink"
      style={selected ? { boxShadow: `0 0 0 3px ${color}, 0 14px 30px rgba(23,24,28,.2)` } : undefined}
      aria-pressed={selected} aria-label={`Vote ${value === 'coffee' ? 'coffee break' : value}`}>
      <span className="absolute top-1.5 left-2 text-xs font-display leading-none text-left" style={{ color: selected ? color : undefined }}>{l}<br /><span className="text-[10px]">{SUIT}</span></span>
      <span className="absolute bottom-1.5 right-2 text-xs font-display leading-none rotate-180 text-left" style={{ color: selected ? color : undefined }}>{l}<br /><span className="text-[10px]">{SUIT}</span></span>
      <span className="font-display text-3xl font-semibold" style={{ color: selected ? color : undefined }}>{l}</span>
    </motion.button>
  )
}

/** The card on the table in front of a seat: face down in the player's colour until the reveal. */
export function SeatCard({ value, faceUp, delay = 0, color = '#FF5A36' }: { value: CardValue | null; faceUp: boolean; delay?: number; color?: string }) {
  if (!value) return <div className="w-11 h-16 rounded-md border-2 border-dashed border-white/50" />
  return (
    <div className="w-11 h-16 [perspective:600px]">
      <motion.div className="relative w-full h-full [transform-style:preserve-3d]" initial={{ y: -20, opacity: 0 }} animate={{ rotateY: faceUp ? 180 : 0, y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: faceUp ? delay : 0 }}>
        <div className="absolute inset-0 rounded-md border-[3px] border-white shadow-md [backface-visibility:hidden]"
          style={{ background: `repeating-linear-gradient(45deg, ${color} 0 4px, ${color}cc 4px 8px)` }} />
        <div className="absolute inset-0 rounded-md bg-white text-ink font-display text-2xl font-semibold grid place-items-center shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]">{label(value)}</div>
      </motion.div>
    </div>
  )
}
