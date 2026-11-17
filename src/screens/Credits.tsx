import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { sprintStats } from '../lib/awards'
import { sfx } from '../lib/sounds'
import type { Sprint } from '../lib/types'
import type { RoomApi } from '../lib/useRoom'

export function Credits({ api, sprint, onClose }: { api: RoomApi; sprint: Sprint; onClose: () => void }) {
  const st = sprintStats(sprint, api.stories, api.votes, api.members)
  useEffect(() => { sfx.fanfare() }, [])
  const lines: [string, string][] = [
    ['Total points', String(st.total)],
    ['Scenes pointed', `${st.pointed.length}`],
    ['Blockbusters', `${st.blockbusters}`],
    ['Plot twists', `${st.twists}`],
    ['Retakes', `${st.retakes}`],
  ]
  const awards: [string, string | undefined][] = [
    ['🎯 Sharpshooter', st.sharpshooter && `${st.sharpshooter.name} (${st.sharpshooter.hits} on the nose)`],
    ['🌀 Most Contrarian', st.contrarian?.name],
    ['☕ Coffee Break MVP', st.coffee && `${st.coffee.name} (${st.coffee.coffee} coffees)`],
  ]
  return (
    <div className="fixed inset-0 z-50 bg-black overflow-hidden cursor-pointer" onClick={onClose}>
      <motion.div className="absolute left-0 right-0 text-center" initial={{ y: '100vh' }} animate={{ y: '-110%' }} transition={{ duration: 22, ease: 'linear' }} onAnimationComplete={onClose}>
        <div className="text-white/50 tracking-[0.4em] text-sm">POINT CLUB PRESENTS</div>
        <div className="font-display text-6xl text-marquee-400 mt-3">{sprint.name}</div>
        {sprint.title && <div className="text-3xl italic mt-2">{sprint.title}</div>}
        <div className="mt-16 grid gap-3 text-xl">{lines.map(([k, v]) => <div key={k}><span className="text-white/50">{k}</span> · <b>{v}</b></div>)}</div>
        <div className="mt-16 font-display text-2xl text-marquee-400">AWARDS</div>
        <div className="mt-4 grid gap-3 text-xl">{awards.filter(([, v]) => v).map(([k, v]) => <div key={k}>{k}<br /><b>{v}</b></div>)}</div>
        <div className="mt-16 font-display text-2xl text-marquee-400">STARRING</div>
        <div className="mt-4 grid gap-1 text-lg">{st.list.map((s) => <div key={s.id}><span className="text-white/50">#{s.number}</span> {s.title} <b className="text-marquee-300">{s.points ?? '–'}</b></div>)}</div>
        <div className="mt-24 text-white/40">Saved to the Film Vault · click anywhere to skip</div>
      </motion.div>
    </div>
  )
}
