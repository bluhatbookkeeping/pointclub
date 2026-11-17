import { useState } from 'react'
import { motion } from 'framer-motion'
import { Avatar } from '../components/Avatar'
import { CAST, castById } from '../lib/cast'
import type { RoomApi } from '../lib/useRoom'

export function Lobby({ api, onEnter }: { api: RoomApi; onEnter: () => void }) {
  const { me, members, activeSprint, actions } = api
  const taken = new Set(members.filter((m) => m.id !== me?.id).map((m) => m.character))
  const [name, setName] = useState(me?.name ?? '')
  const [character, setCharacter] = useState(me?.character ?? CAST.find((c) => !taken.has(c.id))?.id ?? CAST[0].id)
  const [editing, setEditing] = useState(!me)

  const header = (
    <div className="text-center mb-8">
      <div className="font-display text-5xl font-bold tracking-wide">POINT<span className="text-accent">CLUB</span></div>
      <div className="text-ink/60 mt-1">On the board: <b className="text-ink">{activeSprint?.name}</b>{activeSprint?.title ? <> · <i>{activeSprint.title}</i></> : null}</div>
    </div>
  )

  if (me && !editing) {
    const c = castById(me.character)
    return (
      <div className="min-h-screen grid place-items-center">
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="frame p-10 w-[560px] text-center">
          {header}
          <div className="flex justify-center"><Avatar character={me.character} size={110} mood="cheer" /></div>
          <h2 className="font-display text-2xl mt-4">Welcome back, {me.name}</h2>
          <div className="text-ink/60">{c.name}{me.status === 'away' ? ' · marked away' : ''}</div>
          <div className="mt-8 grid gap-3">
            <button className="btn-gold text-lg" onClick={async () => { await actions.setStatus('here'); onEnter() }}>🎟️ Take my seat</button>
            <div className="grid grid-cols-3 gap-3">
              <button className="btn-ghost" onClick={async () => { await actions.setStatus('away'); onEnter() }}>🏖️ Off this job</button>
              <button className="btn-ghost" onClick={() => setEditing(true)}>✏️ Change look</button>
              <button className="btn-ghost text-red-600" onClick={() => confirm('Remove yourself from this room? You can always join again.') && actions.leave()}>🚪 Not me / remove</button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center py-10">
      <div className="frame p-10 w-[860px] max-w-full">
        {header}
        <h2 className="label text-center mb-5 !text-sm">Pick your role on the crew</h2>
        <div className="grid grid-cols-6 gap-3">
          {CAST.map((c) => {
            const isTaken = taken.has(c.id)
            return (
              <button key={c.id} disabled={isTaken} onClick={() => setCharacter(c.id)}
                className={`rounded-xl p-2 flex flex-col items-center gap-1 border-2 transition ${character === c.id ? 'border-accent bg-accent/10' : 'border-transparent hover:bg-ink/5'} disabled:opacity-30`}>
                <Avatar character={c.id} size={58} mood={character === c.id ? 'cheer' : 'idle'} dim={isTaken} />
                <span className="text-[11px] leading-tight text-ink/80">{c.name}</span>
              </button>
            )
          })}
        </div>
        <form className="mt-8 flex gap-3 justify-center" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; if (me) await actions.updateMe({ name: name.trim(), character }); else await actions.join(name, character); onEnter() }}>
          <input className="input w-72 text-lg" placeholder="Your first name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={24} />
          <button className="btn-gold text-lg" disabled={!name.trim()}>Take my seat →</button>
        </form>
        <p className="text-center text-ink/40 text-xs mt-4">No login. This browser remembers you for next sprint.</p>
      </div>
    </div>
  )
}
