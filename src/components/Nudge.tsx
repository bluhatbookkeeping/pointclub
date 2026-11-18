import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BellRing } from 'lucide-react'
import { sfx, isMuted } from '../lib/sounds'
import { voicesEnabled } from '../lib/voice'
import { nudgeLine } from '../lib/reactions'
import type { RoomApi } from '../lib/useRoom'

/** "Hey Jaden, we're still waiting on you." A banner on every screen, read aloud, and a bigger prompt for the person nudged. */
export function Nudge({ api, onNudged }: { api: RoomApi; onNudged: (ids: string[]) => void }) {
  const [shown, setShown] = useState<{ id: number; text: string; forMe: boolean; myName: string } | null>(null)
  useEffect(() => api.actions.onEvent((e) => {
    if (e.kind !== 'nudge') return
    const names = e.to.map((id) => api.members.find((m) => m.id === id)?.name).filter(Boolean) as string[]
    if (!names.length) return
    const text = nudgeLine(e.line, names)
    const forMe = !!api.me && e.to.includes(api.me.id)
    setShown({ id: Math.random(), text, forMe, myName: api.me?.name ?? '' })
    onNudged(e.to)
    sfx.knock()
    if (!isMuted() && voicesEnabled() && 'speechSynthesis' in window) {
      try { const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u) } catch { /* no voice */ }
    }
    setTimeout(() => setShown((s) => (s?.text === text ? null : s)), forMe ? 6000 : 4500)
  }), [api.actions, api.members, api.me]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AnimatePresence>
      {shown && (
        <motion.div key={shown.id} className="pointer-events-none fixed inset-x-0 top-24 z-40 grid place-items-center px-4" initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}>
          <div className={'flex max-w-xl items-center gap-3 rounded-2xl px-5 py-3 shadow-2xl ring-2 ' + (shown.forMe ? 'bg-primary text-primary-foreground ring-primary/40' : 'bg-white text-foreground ring-black/10')} data-testid="nudge-banner">
            <BellRing className="h-6 w-6 shrink-0" />
            <div>
              <div className="text-lg font-semibold leading-snug">{shown.forMe ? `You're up, ${shown.myName}! Pick a card below.` : shown.text}</div>
              {shown.forMe && <div className="text-sm opacity-90">{shown.text}</div>}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
