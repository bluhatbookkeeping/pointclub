import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { sprintStats } from '../lib/awards'
import { sfx } from '../lib/sounds'
import { playMusic } from '../lib/voice'
import { sessionDate, sessionName } from '../lib/utils'
import type { Sprint } from '../lib/types'
import type { RoomApi } from '../lib/useRoom'

export function Credits({ api, sprint, onClose }: { api: RoomApi; sprint: Sprint; onClose: () => void }) {
  const st = sprintStats(sprint, api.stories, api.votes, api.members)
  useEffect(() => { sfx.fanfare(); return playMusic('credits', 0.45, 20_000) }, []) // upbeat music while the credits roll; fades as they finish (22 s) or on close
  const lines: [string, string][] = [
    ['Total points', String(st.total)],
    ['Stories pointed', `${st.pointed.length}`],
    ['Agreed', `${st.blockbusters}`],
    ['Split votes', `${st.twists}`],
    ['Revotes', `${st.retakes}`],
  ]
  const awards: [string, string | undefined][] = [
    ['🎯 Closest to the final points', st.sharpshooter && `${st.sharpshooter.name} (${st.sharpshooter.hits} on the nose)`],
    ['🔀 Most different from the team', st.contrarian?.name],
    ['☕ Most ☕ breaks', st.coffee && `${st.coffee.name} (${st.coffee.coffee})`],
  ]
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-hidden cursor-pointer" onClick={onClose}>
      <motion.div className="absolute left-0 right-0 text-center" initial={{ y: '100vh' }} animate={{ y: '-110%' }} transition={{ duration: 22, ease: 'linear' }} onAnimationComplete={onClose}>
        <div className="text-muted-foreground tracking-[0.4em] text-sm">SESSION RECAP</div>
        <div className="text-7xl font-semibold tracking-tight mt-3">{sessionName(sprint.name)}</div>
        <div className="mt-2 text-xl text-muted-foreground">{sessionDate(sprint)}</div>
        {sprint.title && <div className="text-3xl italic mt-2">{sprint.title}</div>}
        <div className="mt-16 grid gap-3 text-xl">{lines.map(([k, v]) => <div key={k}><span className="text-muted-foreground">{k}</span> · <b>{v}</b></div>)}</div>
        <div className="mt-16 label">Commendations</div>
        <div className="mt-4 grid gap-3 text-xl">{awards.filter(([, v]) => v).map(([k, v]) => <div key={k}>{k}<br /><b>{v}</b></div>)}</div>
        <div className="mt-16 label">The stories</div>
        <div className="mt-4 grid gap-1 text-lg">{st.list.map((s) => <div key={s.id}><span className="text-muted-foreground">#{s.number}</span> {s.title} <b className="text-accent">{s.points ?? '–'}</b></div>)}</div>
        <div className="mt-24 text-ink/40">Saved to Past stories · click anywhere to close</div>
      </motion.div>
    </div>
  )
}
