import { useState } from 'react'
import { motion } from 'framer-motion'
import { sprintStats } from '../lib/awards'
import { castById } from '../lib/cast'
import { label } from '../components/TicketCard'
import type { RoomApi } from '../lib/useRoom'

const OUTCOME: Record<string, string> = { blockbuster: '✅ Clean job', critics: '🤝 Close enough', plottwist: '⚠️ Compromised', none: '–' }

export function Vault({ api, onBack }: { api: RoomApi; onBack: () => void }) {
  const sprints = [...api.sprints].sort((a, b) => b.startedAt - a.startedAt)
  const [openId, setOpenId] = useState<string | null>(null)
  const stats = sprints.map((s) => ({ s, st: sprintStats(s, api.stories, api.votes, api.members) }))
  const maxPts = Math.max(1, ...stats.map((x) => x.st.total))
  const open = stats.find((x) => x.s.id === openId)

  const exportCsv = () => {
    const rows = [['Sprint', 'Movie title', 'Story #', 'Title', 'Points', 'Outcome', 'Takes', 'Votes']]
    for (const { s, st } of stats) for (const story of st.list)
      rows.push([s.name, s.title, story.number, story.title, story.points ?? '', story.outcome ?? '', String(story.rounds),
        st.finalVotes(story).map((v) => `${api.members.find((m) => m.id === v.memberId)?.name ?? '?'}=${label(v.value)}`).join('; ')])
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'point-club-history.csv'; a.click()
  }

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        <button className="btn-ghost" onClick={onBack}>← Back to the table</button>
        <h1 className="font-display text-4xl font-bold tracking-wide">CASE FILES</h1>
        <button className="btn-ghost ml-auto" onClick={exportCsv}>⬇ Export CSV</button>
      </div>

      {/* Velocity */}
      <div className="panel p-4 mb-6">
        <div className="text-sm text-ink/60 mb-2">Points per sprint (velocity)</div>
        <div className="flex items-end gap-3 h-32">
          {[...stats].reverse().map(({ s, st }) => (
            <div key={s.id} className="flex flex-col items-center gap-1 flex-1 max-w-20">
              <div className="text-xs">{st.total}</div>
              <motion.div initial={{ height: 0 }} animate={{ height: (st.total / maxPts) * 90 }} className="w-full rounded-t bg-felt" />
              <div className="text-[11px] text-ink/50 truncate w-full text-center">{s.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Posters */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-5">
        {stats.map(({ s, st }, i) => (
          <motion.button key={s.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -6, rotate: -1 }}
            onClick={() => setOpenId(s.id)} className="aspect-[3/4] rounded-lg p-4 flex flex-col text-left bg-[#F3E9D2] border border-[#d8c9a3] shadow-card relative overflow-hidden">
            <div className="label">{s.closedAt ? 'CASE CLOSED' : 'ACTIVE JOB'}</div>
            <div className="absolute top-0 right-4 w-16 h-5 rounded-b bg-[#e6d6ad]" /><div className="h-1.5 -mx-4 -mt-4 mb-3" style={{ background: `hsl(${(i * 47) % 360} 75% 55%)` }} /><div className="font-display text-3xl font-semibold mt-1 uppercase">{s.name}</div>
            <div className="italic text-lg leading-tight">{s.title}</div>
            <div className="mt-auto text-sm">
              <div className="font-display text-5xl font-bold">{st.total}<span className="text-sm font-body"> pts</span></div>
              <div className="text-ink/70">{st.pointed.length} targets · ✅ {st.blockbusters} clean · ⚠️ {st.twists} compromised</div>
              <div className="text-[11px] text-ink/40 mt-1">{new Date(s.startedAt).toLocaleDateString()}</div>
            </div>
          </motion.button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/40 grid place-items-center p-6" onClick={() => setOpenId(null)}>
          <div className="frame p-6 w-[1000px] max-w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center mb-4"><h2 className="font-display text-2xl text-accent">{open.s.name} <span className="font-body italic text-ink text-lg">{open.s.title}</span></h2><button className="ml-auto btn-ghost" onClick={() => setOpenId(null)}>✕</button></div>
            <div className="flex gap-6 mb-4 text-sm">
              <div>Total <b>{open.st.total}</b></div><div>Clean jobs <b>{open.st.blockbusters}</b></div><div>Compromised <b>{open.st.twists}</b></div>
              {open.st.sharpshooter && <div>🎯 {open.st.sharpshooter.name}</div>}{open.st.contrarian && <div>🌀 {open.st.contrarian.name}</div>}
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-ink/50"><tr><th className="p-2">Story</th><th className="p-2">Points</th><th className="p-2">Outcome</th><th className="p-2">Final votes</th></tr></thead>
              <tbody>{open.st.list.map((story) => (
                <tr key={story.id} className="border-t border-ink/10 align-top">
                  <td className="p-2"><span className="text-accent">#{story.number}</span> {story.url ? <a className="underline decoration-ink/30 hover:text-accent" href={story.url} target="_blank" rel="noreferrer">{story.title}</a> : story.title}</td>
                  <td className="p-2 font-display text-lg">{story.points ? label(story.points) : '–'}</td>
                  <td className="p-2 whitespace-nowrap">{OUTCOME[story.outcome ?? 'none']}{story.rounds > 1 ? ` · ${story.rounds} attempts` : ''}</td>
                  <td className="p-2"><div className="flex flex-wrap gap-2">{open.st.finalVotes(story).map((v) => {
                    const m = api.members.find((x) => x.id === v.memberId)
                    return <span key={v.id} className="bg-ink/5 rounded px-1.5"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: m ? castById(m.character).color : '#999' }} />{m?.name ?? '?'} <b>{label(v.value)}</b></span>
                  })}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
