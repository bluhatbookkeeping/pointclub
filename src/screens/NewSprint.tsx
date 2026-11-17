import { useState } from 'react'
import type { RoomApi } from '../lib/useRoom'

export function NewSprint({ api, onClose }: { api: RoomApi; onClose: () => void }) {
  const cur = api.activeSprint
  const nextNum = (Number(cur?.name.match(/\d+/)?.[0]) || api.sprints.length) + 1
  const [name, setName] = useState(`Sprint ${nextNum}`)
  const [title, setTitle] = useState('')
  const unpointed = api.lineup.filter((s) => !s.points).length
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 grid place-items-center" onClick={onClose}>
      <form className="frame p-6 w-[480px]" onClick={(e) => e.stopPropagation()} onSubmit={async (e) => { e.preventDefault(); await api.actions.closeAndStartNext(name, title); onClose() }}>
        <h2 className="font-display text-2xl text-accent mb-1">🎞️ Wrap the job</h2>
        <p className="text-ink/60 text-sm mb-4">Close <b>{cur?.name}</b>, show everyone the take, and file it in Case Files.{unpointed ? ` ${unpointed} unpointed ${unpointed === 1 ? 'story stays' : 'stories stay'} in the old sprint.` : ''}</p>
        <label className="text-sm text-ink/70">Next sprint</label>
        <input className="input w-full mb-3" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="text-sm text-ink/70">Job codename (optional)</label>
        <input className="input w-full mb-5" placeholder="e.g. Operation Invoice" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-gold">Show the take & start {name}</button></div>
      </form>
    </div>
  )
}
