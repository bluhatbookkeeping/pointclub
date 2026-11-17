import { useState } from 'react'
import { motion } from 'framer-motion'
import { sprintStats } from '../lib/awards'
import { castById } from '../lib/cast'
import { label } from '../components/TicketCard'
import type { RoomApi } from '../lib/useRoom'

const OUTCOME: Record<string, string> = { blockbuster: '🏆 Blockbuster', critics: "⭐ Critics' Choice", plottwist: '🌀 Plot Twist', none: '–' }

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
        <button className="btn-ghost" onClick={onBack}>← Back to the theater</button>
        <h1 className="font-display text-3xl text-marquee-400">🏛️ THE FILM VAULT</h1>
        <button className="btn-ghost ml-auto" onClick={exportCsv}>⬇ Export CSV</button>
      </div>

      {/* Velocity */}
      <div className="panel p-4 mb-6">
        <div className="text-sm text-white/60 mb-2">Points per sprint (velocity)</div>
        <div className="flex items-end gap-3 h-32">
          {[...stats].reverse().map(({ s, st }) => (
            <div key={s.id} className="flex flex-col items-center gap-1 flex-1 max-w-20">
              <div className="text-xs">{st.total}</div>
              <motion.div initial={{ height: 0 }} animate={{ height: (st.total / maxPts) * 90 }} className="w-full rounded-t bg-marquee-400" />
              <div className="text-[11px] text-white/50 truncate w-full text-center">{s.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Posters */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-5">
        {stats.map(({ s, st }, i) => (
          <motion.button key={s.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -6, rotate: -1 }}
            onClick={() => setOpenId(s.id)} className="aspect-[2/3] rounded-xl p-4 flex flex-col text-left border-2 border-marquee-500/60 shadow-xl"
            style={{ background: `linear-gradient(160deg, hsl(${(i * 47) % 360} 55% 28%), #12060a)` }}>
            <div className="text-[10px] tracking-[0.3em] text-white/60">{s.closedAt ? 'NOW IN THE VAULT' : 'NOW SHOWING'}</div>
            <div className="font-display text-2xl mt-2 text-marquee-400">{s.name}</div>
            <div className="italic text-lg leading-tight">{s.title}</div>
            <div className="mt-auto text-sm">
              <div className="font-display text-4xl">{st.total}<span className="text-sm font-body"> pts</span></div>
              <div className="text-white/70">{st.pointed.length} scenes · 🏆 {st.blockbusters} · 🌀 {st.twists}</div>
              <div className="text-[11px] text-white/40 mt-1">{new Date(s.startedAt).toLocaleDateString()}</div>
            </div>
          </motion.button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-6" onClick={() => setOpenId(null)}>
          <div className="marquee-frame p-6 w-[1000px] max-w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center mb-4"><h2 className="font-display text-2xl text-marquee-400">{open.s.name} <span className="font-body italic text-white text-lg">{open.s.title}</span></h2><button className="ml-auto btn-ghost" onClick={() => setOpenId(null)}>✕</button></div>
            <div className="flex gap-6 mb-4 text-sm">
              <div>Total <b>{open.st.total}</b></div><div>Blockbusters <b>{open.st.blockbusters}</b></div><div>Plot twists <b>{open.st.twists}</b></div>
              {open.st.sharpshooter && <div>🎯 {open.st.sharpshooter.name}</div>}{open.st.contrarian && <div>🌀 {open.st.contrarian.name}</div>}
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-white/50"><tr><th className="p-2">Story</th><th className="p-2">Points</th><th className="p-2">Outcome</th><th className="p-2">Final votes</th></tr></thead>
              <tbody>{open.st.list.map((story) => (
                <tr key={story.id} className="border-t border-white/10 align-top">
                  <td className="p-2"><span className="text-marquee-300">#{story.number}</span> {story.url ? <a className="underline decoration-white/30 hover:text-marquee-300" href={story.url} target="_blank" rel="noreferrer">{story.title}</a> : story.title}</td>
                  <td className="p-2 font-display text-lg">{story.points ? label(story.points) : '–'}</td>
                  <td className="p-2 whitespace-nowrap">{OUTCOME[story.outcome ?? 'none']}{story.rounds > 1 ? ` · ${story.rounds} takes` : ''}</td>
                  <td className="p-2"><div className="flex flex-wrap gap-2">{open.st.finalVotes(story).map((v) => {
                    const m = api.members.find((x) => x.id === v.memberId)
                    return <span key={v.id} className="bg-white/10 rounded px-1.5">{m ? castById(m.character).emoji : '👤'} {m?.name ?? '?'} <b>{label(v.value)}</b></span>
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
