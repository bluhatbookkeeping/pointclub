import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Avatar } from '../components/Avatar'
import { SeatCard, TicketCard, label } from '../components/TicketCard'
import { Countdown, Verdict } from '../components/RevealFx'
import { Throws } from '../components/Throws'
import { LoadStories } from './LoadStories'
import { NewSprint } from './NewSprint'
import { Credits } from './Credits'
import { castById } from '../lib/cast'
import { blockbusterBurst, clearFx, sparkleBurst } from '../lib/fx'
import { isMuted, setMuted, sfx } from '../lib/sounds'
import { DECK, NUMERIC, Outcome } from '../lib/types'
import type { RoomApi } from '../lib/useRoom'

type Phase = 'voting' | 'countdown' | 'shown'

export function Theater({ api, openVault, onLobby }: { api: RoomApi; openVault: () => void; onLobby: () => void }) {
  const { room, members, me, current, lineup, roundVotes, myVote, isHost, result, actions, activeSprint, sprints, mode } = api
  const here = members.filter((m) => m.status === 'here').sort((a, b) => a.name.localeCompare(b.name))
  const away = members.filter((m) => m.status === 'away')
  const [phase, setPhase] = useState<Phase>(room?.revealed ? 'shown' : 'voting')
  const [verdict, setVerdict] = useState<Outcome | null>(null)
  const [muted, setMute] = useState(isMuted())
  const [showLoad, setShowLoad] = useState(false)
  const [showNewSprint, setShowNewSprint] = useState(false)
  const [creditsFor, setCreditsFor] = useState<string | null>(null)
  const [throwMenu, setThrowMenu] = useState<string | null>(null)
  const key = `${current?.id}:${room?.round}`
  const prev = useRef({ key, revealed: room?.revealed, sprint: room?.activeSprintId })

  // Reveal choreography: runs on every screen when the host reveals.
  useEffect(() => {
    const p = prev.current
    if (room?.revealed && !(p.revealed && p.key === key)) {
      setPhase('countdown'); setVerdict(null)
    } else if (!room?.revealed) { setPhase('voting'); setVerdict(null) }
    if (p.sprint && room?.activeSprintId !== p.sprint) setCreditsFor(p.sprint)
    prev.current = { key, revealed: room?.revealed, sprint: room?.activeSprintId }
  }, [room?.revealed, key, room?.activeSprintId])

  const finishCountdown = () => {
    setPhase('shown')
    const o = result?.outcome ?? 'none'
    setVerdict(o)
    if (o === 'blockbuster') { sfx.fanfare(); blockbusterBurst() }
    else if (o === 'critics') { sfx.sparkle(); sparkleBurst() }
    else if (o === 'plottwist') { clearFx(); sfx.scratch() }
    setTimeout(() => setVerdict(null), 2600)
  }

  const voteOf = (id: string) => roundVotes.find((v) => v.memberId === id)?.value ?? null
  const shown = phase === 'shown'
  const spotlight = shown && result?.outcome === 'plottwist' ? new Set([result.low, result.high]) : null
  const openAdo = () => {
    if (!current?.url) return
    const w = Math.min(960, screen.availWidth / 2)
    window.open(current.url, 'pointclub-ado', `width=${w},height=${screen.availHeight},left=${screen.availWidth - w},top=0`)
  }
  const pointedCount = lineup.filter((s) => s.points).length
  const totalPts = lineup.reduce((s, x) => s + (Number(x.points) || 0), 0)

  return (
    <div className="min-h-screen flex flex-col py-4 gap-4">
      {/* Top bar */}
      <header className="flex items-center gap-3">
        <div className="font-display text-xl text-marquee-400">★ POINT CLUB</div>
        <div className="text-white/70 text-sm">{activeSprint?.name}{activeSprint?.title ? ` · ${activeSprint.title}` : ''} · {pointedCount}/{lineup.length} scenes · {totalPts} pts</div>
        {mode === 'local' && <span className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-white/60" title="Tabs in this browser share the room. Connect Supabase to share with the team.">demo mode</span>}
        <div className="ml-auto flex gap-2">
          {isHost && <button className="btn-ghost text-sm" onClick={() => setShowLoad(true)}>📸 Load stories</button>}
          {isHost && <button className="btn-ghost text-sm" onClick={() => setShowNewSprint(true)}>🎞️ Wrap sprint</button>}
          <button className="btn-ghost text-sm" onClick={openVault}>🏛️ Film Vault</button>
          <button className="btn-ghost text-sm" onClick={() => navigator.clipboard?.writeText(location.href).then(() => alert('Room link copied. Share it with the team.'))}>🔗 Copy link</button>
          <button className="btn-ghost text-sm" onClick={() => { setMuted(!muted); setMute(!muted) }} aria-label="Toggle sound">{muted ? '🔇' : '🔊'}</button>
          <button className="btn-ghost text-sm" onClick={onLobby} title="Back to lobby">{me && <span>{castById(me.character).emoji}</span>} Me</button>
        </div>
      </header>

      <div className="flex gap-4 flex-1">
        {/* Scene list */}
        <aside className="panel w-72 p-3 flex flex-col gap-1 max-h-[calc(100vh-110px)] overflow-auto">
          <div className="font-display text-sm text-marquee-400 px-1 mb-1">TONIGHT'S LINEUP</div>
          {lineup.length === 0 && <div className="text-white/50 text-sm p-2">No scenes yet. {isHost ? 'Click “Load stories” to add them from a screenshot.' : 'Waiting for the host to load stories.'}</div>}
          {lineup.map((s, i) => (
            <button key={s.id} onClick={() => isHost && actions.selectStory(s.id)} disabled={!isHost}
              className={`text-left rounded-lg px-2 py-1.5 flex gap-2 items-start transition ${s.id === current?.id ? 'bg-marquee-400/15 ring-1 ring-marquee-400' : 'hover:bg-white/5'} disabled:cursor-default`}>
              <span className="text-white/40 text-xs w-5 pt-0.5">{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs text-marquee-300">#{s.number}</span>
                <span className="block text-sm leading-snug truncate" title={s.title}>{s.title}</span>
              </span>
              {s.points ? <span className="font-display text-sm bg-screen text-velvet-800 rounded px-1.5">{label(s.points)}</span> : <span className="text-white/30 text-xs pt-1">○</span>}
            </button>
          ))}
        </aside>

        {/* Stage */}
        <main className="flex-1 flex flex-col gap-5 min-w-0">
          <div className="marquee-frame px-6 py-5 text-center">
            {current ? (
              <>
                <div className="text-xs tracking-[0.3em] text-white/50">NOW SHOWING · SCENE {lineup.findIndex((s) => s.id === current.id) + 1} OF {lineup.length}{room && room.round > 1 ? ` · TAKE ${room.round}` : ''}</div>
                <div className="font-display text-3xl mt-1"><span className="text-marquee-400">#{current.number}</span> {current.title}</div>
                <div className="mt-3 flex justify-center gap-2">
                  {current.url ? <button className="btn-ghost text-sm" onClick={openAdo}>Open in ADO ↗</button> : isHost ? <span className="text-xs text-white/40">Set your ADO link pattern in “Load stories” to get story links</span> : null}
                </div>
              </>
            ) : <div className="font-display text-2xl text-white/60 py-4">The screen is dark. {isHost ? 'Load stories to start the show.' : 'Waiting for the host…'}</div>}
          </div>

          {/* Seats */}
          <section className="relative flex flex-wrap justify-center gap-x-6 gap-y-6 pt-6 px-4">
            {here.map((m, i) => {
              const v = voteOf(m.id)
              const isSpot = !!(spotlight && v && spotlight.has(v))
              const mood = shown && verdict === 'blockbuster' ? 'cheer' : shown && verdict === 'plottwist' ? 'shock' : !v && current && !shown ? 'thinking' : 'idle'
              const arc = Math.abs(i - (here.length - 1) / 2)
              return (
                <div key={m.id} data-seat={m.id} className="relative flex flex-col items-center gap-2" style={{ marginTop: arc * 6 }}>
                  {isSpot && <motion.div layoutId={undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -inset-6 -top-16 rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(255,240,180,.45), transparent 70%)' }} />}
                                    <button onClick={() => m.id !== me?.id && setThrowMenu(throwMenu === m.id ? null : m.id)} className="relative" title={m.id === me?.id ? 'You' : `Throw something at ${m.name}`}>
                    <Avatar character={m.character} size={68} mood={mood} />
                    {room?.hostId === m.id && <span className="absolute -top-2 -right-2 text-lg" title="Host">🎬</span>}
                    {v && !shown && <span className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full w-5 h-5 text-xs grid place-items-center">✓</span>}
                  </button>
                  <SeatCard value={v} faceUp={shown} delay={i * 0.08} />
                  <div className="text-sm font-semibold">{m.name}{m.id === me?.id ? ' (you)' : ''}</div>
                  {isSpot && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="whitespace-nowrap text-[11px] bg-screen text-velvet-800 rounded-full px-2 py-0.5 font-semibold">🎤 Defend it!</motion.div>}
                  <AnimatePresence>
                    {throwMenu === m.id && (
                      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} className="absolute top-20 z-30 panel p-1.5 flex gap-1 bg-velvet-900">
                        {['🍿', '🍅', '⭐', '🌹', '🥤'].map((it) => (
                          <button key={it} className="text-2xl hover:scale-125 transition" onClick={() => { actions.send({ kind: 'throw', from: me!.id, to: m.id, item: it }); setThrowMenu(null) }}>{it}</button>
                        ))}
                        {isHost && <button className="text-xs px-2 text-white/70 hover:text-white" onClick={() => { actions.makeHost(m.id); setThrowMenu(null) }}>Make host</button>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </section>
          {away.length > 0 && <div className="text-center text-sm text-white/50">Away tonight: {away.map((m) => `${castById(m.character).emoji} ${m.name}`).join(' · ')}</div>}
          {room && !members.some((m) => m.id === room.hostId && m.status === 'here') && <div className="text-center"><button className="btn-ghost text-sm" onClick={actions.claimHost}>🎬 No host right now. Take the director's chair</button></div>}

          {/* Results + host controls */}
          {current && (
            <div className="flex flex-col items-center gap-3 mt-auto">
              {shown && result && <Results result={result} />}
              {isHost && (
                <div className="flex flex-wrap gap-2 justify-center items-center">
                  {!room?.revealed && <button className="btn-gold text-lg" disabled={roundVotes.length === 0} onClick={() => { actions.reveal() }}>🎥 Roll the reveal ({roundVotes.length}/{here.length})</button>}
                  {shown && <>
                    <span className="text-sm text-white/60">Lock it in:</span>
                    {NUMERIC.map((n) => (
                      <button key={n} onClick={() => actions.lockIn(n)} className={`btn text-sm ${n === result?.suggested ? 'bg-marquee-400 text-velvet-950 shadow-bulb' : 'bg-white/10 hover:bg-white/20'}`}>{n}</button>
                    ))}
                    <button className="btn-ghost text-sm" onClick={actions.revote}>🎬 Take {(room?.round ?? 1) + 1} (revote)</button>
                  </>}
                </div>
              )}
              {!isHost && !room?.revealed && <div className="text-sm text-white/50">{roundVotes.length}/{here.length} voted · the host rolls the reveal</div>}
            </div>
          )}

          {/* Hand */}
          {me?.status === 'here' ? (
            <div className="flex justify-center gap-3 pb-2 pt-4">
              {DECK.map((v) => <TicketCard key={v} value={v} selected={myVote === v} disabled={!current || !!room?.revealed} onClick={() => { sfx.pick(); actions.vote(v) }} />)}
            </div>
          ) : (
            <div className="text-center pb-4"><span className="text-white/60">You're marked away, so you're watching.</span> <button className="btn-gold ml-2" onClick={() => actions.setStatus('here')}>Take my seat</button></div>
          )}
        </main>
      </div>

      <Throws api={api} />
      <AnimatePresence>{phase === 'countdown' && <Countdown onDone={finishCountdown} />}</AnimatePresence>
      <AnimatePresence>{verdict && verdict !== 'none' && <Verdict outcome={verdict} points={result?.suggested ?? ''} />}</AnimatePresence>
      {showLoad && <LoadStories api={api} onClose={() => setShowLoad(false)} />}
      {showNewSprint && <NewSprint api={api} onClose={() => setShowNewSprint(false)} />}
      {creditsFor && <Credits api={api} sprint={sprints.find((s) => s.id === creditsFor)!} onClose={() => setCreditsFor(null)} />}
    </div>
  )
}

function Results({ result }: { result: NonNullable<RoomApi['result']> }) {
  const entries = DECK.filter((v) => result.counts[v])
  const max = Math.max(...entries.map((v) => result.counts[v]), 1)
  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="panel px-5 py-3 flex items-end gap-6">
      <div className="text-center"><div className="text-xs text-white/50">AVERAGE</div><div className="font-display text-2xl">{result.average ?? '–'}</div></div>
      <div className="text-center"><div className="text-xs text-white/50">CROWD PICK</div><div className="font-display text-2xl text-marquee-400">{result.suggested ?? '–'}</div></div>
      <div className="flex items-end gap-2 h-16">
        {entries.map((v) => (
          <div key={v} className="flex flex-col items-center gap-1">
            <motion.div initial={{ height: 0 }} animate={{ height: (result.counts[v] / max) * 44 }} className="w-6 rounded-t bg-marquee-400" />
            <div className="text-xs">{label(v)} <span className="text-white/40">×{result.counts[v]}</span></div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
