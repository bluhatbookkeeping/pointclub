import { useState } from 'react'
import type { RoomApi } from '../lib/useRoom'

export function NewSprint({ api, onClose }: { api: RoomApi; onClose: () => void }) {
  const cur = api.activeSprint
  const nextNum = (Number(cur?.name.match(/\d+/)?.[0]) || api.sprints.length) + 1
  const [name, setName] = useState(`Sprint ${nextNum}`)
  const [title, setTitle] = useState('')
  const unpointed = api.lineup.filter((s) => !s.points).length
  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center" onClick={onClose}>
      <form className="marquee-frame p-6 w-[480px]" onClick={(e) => e.stopPropagation()} onSubmit={async (e) => { e.preventDefault(); await api.actions.closeAndStartNext(name, title); onClose() }}>
        <h2 className="font-display text-2xl text-marquee-400 mb-1">🎞️ That's a wrap</h2>
        <p className="text-white/60 text-sm mb-4">Close <b>{cur?.name}</b>, roll the credits for everyone, and save it to the Film Vault.{unpointed ? ` ${unpointed} unpointed ${unpointed === 1 ? 'story stays' : 'stories stay'} in the old sprint.` : ''}</p>
        <label className="text-sm text-white/70">Next sprint</label>
        <input className="input w-full mb-3" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="text-sm text-white/70">Movie title (optional, for the poster)</label>
        <input className="input w-full mb-5" placeholder="e.g. The Invoice Strikes Again" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-gold">Roll credits & start {name}</button></div>
      </form>
    </div>
  )
}
