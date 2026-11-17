import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { SeatCard } from '@/components/TicketCard'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { castById } from '@/lib/cast'
import type { CardValue, Member } from '@/lib/types'

// Design space: the table is 1000x420 inside a 1160x640 frame so seats can sit outside the rail.
const FW = 1160, FH = 640, TW = 1000, TH = 420, OX = (FW - TW) / 2, OY = (FH - TH) / 2

/** Point on the stadium-shaped rail, `t` in [0,1) starting bottom-centre going clockwise, pushed out by `off`. */
function railPoint(t: number, off: number) {
  const r = TH / 2, L = TW - TH, P = 2 * L + 2 * Math.PI * r
  let s = (t % 1) * P
  const cx = OX + TW / 2, cy = OY + TH / 2
  const segs: Array<[number, (u: number) => [number, number]]> = [
    [L / 2, (u) => [cx - u, cy + r + off]],                                   // bottom, centre → left
    [Math.PI * r, (u) => { const a = Math.PI / 2 + u / r; return [cx - L / 2 + Math.cos(a) * (r + off), cy + Math.sin(a) * (r + off)] }], // left end
    [L, (u) => [cx - L / 2 + u, cy - r - off]],                               // top, left → right
    [Math.PI * r, (u) => { const a = -Math.PI / 2 + u / r; return [cx + L / 2 + Math.cos(a) * (r + off), cy + Math.sin(a) * (r + off)] }], // right end
    [L / 2, (u) => [cx + L / 2 - u, cy + r + off]],                           // bottom, right → centre
  ]
  for (const [len, f] of segs) { if (s <= len) { const [x, y] = f(s); return { x: (x / FW) * 100, y: (y / FH) * 100 } } s -= len }
  return { x: 50, y: 100 }
}

export interface SeatInfo { member: Member; vote: CardValue | null; isHost: boolean; isMe: boolean; spotlight: boolean; mood: 'idle' | 'thinking' | 'cheer' | 'shock'; menu?: React.ReactNode; dealer?: boolean }

export function PokerTable({ seats, faceUp, votesIn, center }: { seats: SeatInfo[]; faceUp: boolean; votesIn: number; center?: React.ReactNode }) {
  // Put "me" at the bottom centre, everyone else evenly around the rail.
  const meIdx = Math.max(0, seats.findIndex((s) => s.isMe))
  const ordered = [...seats.slice(meIdx), ...seats.slice(0, meIdx)]
  const n = Math.max(ordered.length, 1)
  return (
    <div className="relative mx-auto mb-10 w-full max-w-[min(960px,calc((100vh-440px)*1.8125))] select-none" style={{ aspectRatio: `${FW} / ${FH}` }}>
      {/* Table */}
      <div className="absolute rounded-full" style={{ left: `${(OX / FW) * 100}%`, top: `${(OY / FH) * 100}%`, width: `${(TW / FW) * 100}%`, height: `${(TH / FH) * 100}%` }}>
        <div className="vegas-rail absolute inset-0 rounded-full" />
        <div className="vegas-wood absolute rounded-full" style={{ top: '9%', bottom: '9%', left: '3.8%', right: '3.8%' }} />
        <div className="vegas-felt absolute rounded-full grid place-items-center" style={{ top: '11.5%', bottom: '11.5%', left: '4.8%', right: '4.8%' }}>
          <div className="absolute rounded-full border-2 border-[#d4af37]/50" style={{ inset: '16% 11%' }} />
          {center ? <div className="relative z-[5]">{center}</div> : <div className="text-center pointer-events-none">
            <div className="font-display text-[clamp(18px,3vw,38px)] font-semibold tracking-[0.35em] text-[#d4af37]/35">POINT CLUB</div>
            <div className="text-[clamp(8px,0.9vw,11px)] tracking-[0.5em] text-[#d4af37]/30 uppercase">Story pointing · Las Vegas</div>
            <div className="mt-2 flex h-9 justify-center">{votesIn > 0 && !faceUp && <ChipPot count={votesIn} />}</div>
          </div>}
        </div>
      </div>

      {/* Cards on the felt */}
      {ordered.map((s, i) => {
        const p = railPoint(i / n, -112)
        if (s.dealer) return null // the dealer doesn't play a card
        return (
          <div key={'c' + s.member.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            {/* Sitting out and coffee aren't secret estimates, so they show right away. */}
            <SeatCard value={s.vote} faceUp={faceUp || s.vote === 'pass' || s.vote === 'coffee'} delay={i * 0.08} color={castById(s.member.character).color} />
          </div>
        )
      })}

      {/* Seats around the rail */}
      {ordered.map((s, i) => {
        const p = railPoint(i / n, 34)
        const c = castById(s.member.character)
        const seat = (
          <button className="relative rounded-full" disabled={s.isMe} aria-label={s.member.name}>
            <Avatar character={s.member.character} name={s.member.name} size={64} mood={s.mood} />
            {s.isHost && <span title="Host (dealer)" className="absolute -top-1 -right-2 grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] font-black text-black shadow ring-1 ring-black/20">D</span>}
            {s.vote && !faceUp && <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white"><Check className="h-3 w-3" /></span>}
          </button>
        )
        return (
          <div key={s.member.id} data-seat={s.member.id} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            {s.spotlight && <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} className="absolute -inset-8 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,214,102,.55), transparent 70%)' }} />}
            {s.menu ? <Popover><PopoverTrigger asChild>{seat}</PopoverTrigger><PopoverContent className="w-auto p-1.5 flex items-center gap-1">{s.menu}</PopoverContent></Popover> : seat}
            <div className="rounded-md border bg-background/95 px-2 py-0.5 text-center shadow-sm leading-tight">
              <div className="text-xs font-semibold whitespace-nowrap">{s.member.name}{s.isMe ? ' (you)' : ''}</div>
              {s.dealer && <div className="text-[10px] font-semibold uppercase tracking-wider text-[#a8862a]">Dealer</div>}
              {!faceUp && s.vote === 'pass' && <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" data-testid="seat-out">Sitting out</div>}
              {!faceUp && s.vote === 'coffee' && <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700" data-testid="seat-coffee">☕ Needs a break</div>}
            </div>
            {s.spotlight && <Badge variant="destructive" className="uppercase tracking-wider text-[10px]">Explain your vote</Badge>}
          </div>
        )
      })}
    </div>
  )
}

const CHIP_COLORS = ['#c0392b', '#1f4fbf', '#111111', '#1e8449', '#7d3c98', '#d68910']
function ChipPot({ count }: { count: number }) {
  return (
    <div className="flex items-end gap-1.5">
      {Array.from({ length: Math.min(count, 6) }).map((_, s) => (
        <div key={s} className="relative w-9" style={{ height: 36 }}>
          {Array.from({ length: Math.min(2 + ((count + s) % 4), 6) }).map((_, k) => (
            <motion.div key={k} initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: k * 0.04 }}
              className="vegas-chip absolute left-0 w-9 h-[10px] rounded-[50%]" style={{ bottom: k * 5, ['--chip' as any]: CHIP_COLORS[(s + k) % CHIP_COLORS.length] }} />
          ))}
        </div>
      ))}
    </div>
  )
}
