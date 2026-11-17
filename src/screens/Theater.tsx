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
        <div className="font-display text-2xl font-bold tracking-wide">POINT<span className="text-accent">CLUB</span></div>
        <div className="text-ink/70 text-sm">{activeSprint?.name}{activeSprint?.title ? ` · ${activeSprint.title}` : ''} · {pointedCount}/{lineup.length} targets · {totalPts} pts</div>
        {mode === 'local' && <span className="text-[11px] px-2 py-0.5 rounded bg-ink/5 text-ink/60" title="Tabs in this browser share the room. Connect Supabase to share with the team.">demo mode</span>}
        <div className="ml-auto flex gap-2">
          {isHost && <button className="btn-ghost text-sm" onClick={() => setShowLoad(true)}>📸 Load targets</button>}
          {isHost && <button className="btn-ghost text-sm" onClick={() => setShowNewSprint(true)}>🎞️ Wrap the job</button>}
          <button className="btn-ghost text-sm" onClick={openVault}>🗂️ Case Files</button>
          <button className="btn-ghost text-sm" onClick={() => navigator.clipboard?.writeText(location.href).then(() => alert('Room link copied. Share it with the team.'))}>🔗 Copy link</button>
          <button className="btn-ghost text-sm" onClick={() => { setMuted(!muted); setMute(!muted) }} aria-label="Toggle sound">{muted ? '🔇' : '🔊'}</button>
          <button className="btn-ghost text-sm" onClick={onLobby} title="Back to lobby">Me</button>
        </div>
      </header>

      <div className="flex gap-4 flex-1">
        {/* Scene list */}
        <aside className="panel w-72 p-3 flex flex-col gap-1 max-h-[calc(100vh-110px)] overflow-auto">
          <div className="font-display text-sm text-accent px-1 mb-1">THE TARGETS</div>
          {lineup.length === 0 && <div className="text-ink/50 text-sm p-2">No targets yet. {isHost ? 'Click “Load targets” to add stories from a screenshot.' : 'Waiting for the Fixer (host) to load stories.'}</div>}
          {lineup.map((s, i) => (
            <button key={s.id} onClick={() => isHost && actions.selectStory(s.id)} disabled={!isHost}
              className={`text-left rounded-lg px-2 py-1.5 flex gap-2 items-start transition ${s.id === current?.id ? 'bg-accent/10 ring-1 ring-accent' : 'hover:bg-ink/5'} disabled:cursor-default`}>
              <span className="text-ink/40 text-xs w-5 pt-0.5">{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs text-accent font-semibold">#{s.number}</span>
                <span className="block text-sm leading-snug truncate" title={s.title}>{s.title}</span>
              </span>
              {s.points ? <span className="font-display text-sm bg-ink text-white rounded px-1.5">{label(s.points)}</span> : <span className="text-ink/30 text-xs pt-1">○</span>}
            </button>
          ))}
        </aside>

        {/* Stage */}
        <main className="flex-1 flex flex-col gap-5 min-w-0">
          <div className="frame px-6 py-5 text-center">
            {current ? (
              <>
                <div className="label">THE JOB · TARGET {lineup.findIndex((s) => s.id === current.id) + 1} OF {lineup.length}{room && room.round > 1 ? ` · ATTEMPT ${room.round}` : ''}</div>
                <div className="font-display text-4xl font-semibold mt-1 uppercase"><span className="text-accent">#{current.number}</span> {current.title}</div>
                <div className="mt-3 flex justify-center gap-2">
                  {current.url ? <button className="btn-ghost text-sm" onClick={openAdo}>Open in ADO ↗</button> : isHost ? <span className="text-xs text-ink/40">Set your ADO link pattern in “Load stories” to get story links</span> : null}
                </div>
              </>
            ) : <div className="font-display text-2xl text-ink/60 py-4">No job on the board. {isHost ? 'Load targets to start planning.' : 'Waiting for the Fixer…'}</div>}
          </div>

          {/* Seats */}
          <section className="felt-table relative mx-auto w-full max-w-5xl rounded-[200px] flex flex-wrap justify-center items-start gap-x-8 gap-y-6 px-16 py-10 min-h-[260px]">
            {here.map((m, i) => {
              const v = voteOf(m.id)
              const isSpot = !!(spotlight && v && spotlight.has(v))
              const mood = shown && verdict === 'blockbuster' ? 'cheer' : shown && verdict === 'plottwist' ? 'shock' : !v && current && !shown ? 'thinking' : 'idle'
              const arc = Math.abs(i - (here.length - 1) / 2)
              return (
                <div key={m.id} data-seat={m.id} className="relative flex flex-col items-center gap-2" style={{ marginTop: arc * 6 }}>
                  {isSpot && <motion.div layoutId={undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -inset-6 -top-16 rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,.55), transparent 70%)' }} />}
                                    <button onClick={() => m.id !== me?.id && setThrowMenu(throwMenu === m.id ? null : m.id)} className="relative" title={m.id === me?.id ? 'You' : `Throw something at ${m.name}`}>
                    <Avatar character={m.character} size={68} mood={mood} />
                    {room?.hostId === m.id && <span className="absolute -top-2 -right-2 text-lg" title="The Fixer (host)">🎩</span>}
                    {v && !shown && <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full w-5 h-5 text-xs grid place-items-center">✓</span>}
                  </button>
                  <SeatCard value={v} faceUp={shown} delay={i * 0.08} color={castById(m.character).color} />
                  <div className="text-center leading-tight"><div className="text-sm font-bold text-white drop-shadow">{m.name}{m.id === me?.id ? ' (you)' : ''}</div><div className="text-[10px] uppercase tracking-widest text-white/80">{castById(m.character).name}</div></div>
                  {isSpot && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="whitespace-nowrap text-[11px] bg-red-600 text-white rounded px-2 py-0.5 font-bold uppercase tracking-wider">Make your case</motion.div>}
                  <AnimatePresence>
                    {throwMenu === m.id && (
                      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }} className="absolute top-20 z-30 panel p-1.5 flex gap-1 bg-white">
                        {['💵', '🪙', '🍅', '🌹', '☕'].map((it) => (
                          <button key={it} className="text-2xl hover:scale-125 transition" onClick={() => { actions.send({ kind: 'throw', from: me!.id, to: m.id, item: it }); setThrowMenu(null) }}>{it}</button>
                        ))}
                        {isHost && <button className="text-xs px-2 text-ink/70 hover:text-ink" onClick={() => { actions.makeHost(m.id); setThrowMenu(null) }}>Make host</button>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </section>
          {away.length > 0 && <div className="text-center text-sm text-ink/50">Off the job: {away.map((m) => `${m.name} (${castById(m.character).name})`).join(' · ')}</div>}
          {room && !members.some((m) => m.id === room.hostId && m.status === 'here') && <div className="text-center"><button className="btn-ghost text-sm" onClick={actions.claimHost}>🎩 No Fixer right now. Run this job</button></div>}

          {/* Results + host controls */}
          {current && (
            <div className="flex flex-col items-center gap-3 mt-auto">
              {shown && result && <Results result={result} />}
              {isHost && (
                <div className="flex flex-wrap gap-2 justify-center items-center">
                  {!room?.revealed && <button className="btn-gold text-lg" disabled={roundVotes.length === 0} onClick={() => { actions.reveal() }}>🃏 Show the cards ({roundVotes.length}/{here.length})</button>}
                  {shown && <>
                    <span className="text-sm text-ink/60">Lock it in:</span>
                    {NUMERIC.map((n) => (
                      <button key={n} onClick={() => actions.lockIn(n)} className={`btn text-sm ${n === result?.suggested ? 'bg-accent text-white shadow-card' : 'bg-white border border-ink/15 hover:bg-stone'}`}>{n}</button>
                    ))}
                    <button className="btn-ghost text-sm" onClick={actions.revote}>🔁 Attempt {(room?.round ?? 1) + 1} (revote)</button>
                  </>}
                </div>
              )}
              {!isHost && !room?.revealed && <div className="text-sm text-ink/50">{roundVotes.length}/{here.length} in · the Fixer shows the cards</div>}
            </div>
          )}

          {/* Hand */}
          {me?.status === 'here' ? (
            <div className="flex justify-center gap-3 pb-2 pt-4">
              {DECK.map((v) => <TicketCard key={v} value={v} color={me ? castById(me.character).color : undefined} selected={myVote === v} disabled={!current || !!room?.revealed} onClick={() => { sfx.pick(); actions.vote(v) }} />)}
            </div>
          ) : (
            <div className="text-center pb-4"><span className="text-ink/60">You're off this job, so you're watching.</span> <button className="btn-gold ml-2" onClick={() => actions.setStatus('here')}>Take my seat</button></div>
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
      <div className="text-center"><div className="label">Average</div><div className="font-display text-2xl">{result.average ?? '–'}</div></div>
      <div className="text-center"><div className="label">Crew pick</div><div className="font-display text-2xl text-accent">{result.suggested ?? '–'}</div></div>
      <div className="flex items-end gap-2 h-16">
        {entries.map((v) => (
          <div key={v} className="flex flex-col items-center gap-1">
            <motion.div initial={{ height: 0 }} animate={{ height: (result.counts[v] / max) * 44 }} className="w-6 rounded-t bg-accent" />
            <div className="text-xs">{label(v)} <span className="text-ink/40">×{result.counts[v]}</span></div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
