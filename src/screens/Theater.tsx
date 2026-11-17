import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Clapperboard, Crown, ExternalLink, FolderOpen, Link2, RotateCcw, Volume2, VolumeX, UserRound, Eye, Check, Circle } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { SeatCard, TicketCard, label } from '@/components/TicketCard'
import { Countdown, Verdict } from '@/components/RevealFx'
import { Throws } from '@/components/Throws'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LoadStories } from './LoadStories'
import { NewSprint } from './NewSprint'
import { Credits } from './Credits'
import { castById } from '@/lib/cast'
import { blockbusterBurst, clearFx, sparkleBurst } from '@/lib/fx'
import { isMuted, setMuted, sfx } from '@/lib/sounds'
import { cn } from '@/lib/utils'
import { DECK, NUMERIC, Outcome } from '@/lib/types'
import type { RoomApi } from '@/lib/useRoom'

type Phase = 'voting' | 'countdown' | 'shown'

function IconBtn({ tip, children, ...p }: React.ComponentProps<typeof Button> & { tip: string }) {
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={tip} {...p}>{children}</Button></TooltipTrigger><TooltipContent>{tip}</TooltipContent></Tooltip>
}

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
  const [copied, setCopied] = useState(false)
  const key = `${current?.id}:${room?.round}`
  const prev = useRef({ key, revealed: room?.revealed, sprint: room?.activeSprintId })

  // Reveal choreography runs on every screen when the host shows the cards.
  useEffect(() => {
    const p = prev.current
    if (room?.revealed && !(p.revealed && p.key === key)) { setPhase('countdown'); setVerdict(null) }
    else if (!room?.revealed) { setPhase('voting'); setVerdict(null) }
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
  const copyLink = () => navigator.clipboard?.writeText(location.href.replace(/[?&]p=\d+/, '')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  const pointedCount = lineup.filter((s) => s.points).length
  const totalPts = lineup.reduce((s, x) => s + (Number(x.points) || 0), 0)
  const hostHere = !!room && members.some((m) => m.id === room.hostId && m.status === 'here')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-6">
          <Logo />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{activeSprint?.name}</span>
            {activeSprint?.title && <span className="text-muted-foreground">{activeSprint.title}</span>}
            <Badge variant="secondary">{pointedCount}/{lineup.length} pointed</Badge>
            <Badge variant="outline">{totalPts} pts</Badge>
            {mode === 'local' && <Tooltip><TooltipTrigger asChild><Badge variant="outline" className="text-muted-foreground">Demo mode</Badge></TooltipTrigger><TooltipContent>Tabs in this browser share the room. Connect Supabase to share with the team.</TooltipContent></Tooltip>}
          </div>
          <div className="ml-auto flex items-center gap-1">
            {isHost && <Button variant="outline" size="sm" onClick={() => setShowLoad(true)}><Camera /> Load targets</Button>}
            {isHost && <Button variant="outline" size="sm" onClick={() => setShowNewSprint(true)}><Clapperboard /> Wrap the job</Button>}
            <Button variant="ghost" size="sm" onClick={openVault}><FolderOpen /> Case Files</Button>
            <IconBtn tip={copied ? 'Copied!' : 'Copy room link'} onClick={copyLink}>{copied ? <Check /> : <Link2 />}</IconBtn>
            <IconBtn tip={muted ? 'Unmute' : 'Mute'} onClick={() => { setMuted(!muted); setMute(!muted) }}>{muted ? <VolumeX /> : <Volume2 />}</IconBtn>
            <IconBtn tip="My seat (lobby)" onClick={onLobby}>{me ? <Avatar character={me.character} size={26} /> : <UserRound />}</IconBtn>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-r">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-auto p-4">
            <div className="label px-2 mb-2">Targets</div>
            {lineup.length === 0 && <p className="text-sm text-muted-foreground px-2">No targets yet. {isHost ? 'Use “Load targets” to add stories from a screenshot.' : 'Waiting for the host.'}</p>}
            <nav className="grid gap-0.5">
              {lineup.map((s) => (
                <button key={s.id} onClick={() => isHost && actions.selectStory(s.id)} disabled={!isHost}
                  className={cn('group flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:cursor-default', s.id === current?.id ? 'bg-secondary font-medium' : 'hover:bg-secondary/60 text-muted-foreground')}>
                  {s.points ? <Check className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />}
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-xs text-muted-foreground">#{s.number}</span>
                    <span className={cn('block truncate', s.id === current?.id && 'text-foreground')} title={s.title}>{s.title}</span>
                  </span>
                  {s.points && <Badge variant="secondary" className="font-mono">{label(s.points)}</Badge>}
                </button>
              ))}
            </nav>
            {away.length > 0 && <>
              <Separator className="my-4" />
              <div className="label px-2 mb-2">Away</div>
              <div className="grid gap-1 px-2">{away.map((m) => <div key={m.id} className="flex items-center gap-2 text-sm text-muted-foreground"><Avatar character={m.character} size={22} dim /> {m.name}</div>)}</div>
            </>}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 flex flex-col gap-6 p-6">
          <Card>
            <CardContent className="p-6 flex items-center gap-6">
              {current ? <>
                <div className="flex-1 min-w-0">
                  <div className="label">Target {lineup.findIndex((s) => s.id === current.id) + 1} of {lineup.length}{room && room.round > 1 ? ` · Attempt ${room.round}` : ''}</div>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight truncate"><span className="font-mono text-accent">#{current.number}</span> {current.title}</h1>
                </div>
                {current.url ? <Button variant="outline" onClick={openAdo}>Open in ADO <ExternalLink /></Button>
                  : isHost ? <span className="text-xs text-muted-foreground max-w-48">Set your ADO link pattern in “Load targets” to get story links.</span> : null}
              </> : <div className="text-muted-foreground">No job on the board. {isHost ? 'Load targets to start planning.' : 'Waiting for the host…'}</div>}
            </CardContent>
          </Card>

          {/* The table */}
          <section className="felt-table relative mx-auto w-full max-w-5xl rounded-[200px] flex flex-wrap justify-center items-start gap-x-8 gap-y-6 px-16 py-10 min-h-[260px]">
            {here.map((m, i) => {
              const v = voteOf(m.id), c = castById(m.character)
              const isSpot = !!(spotlight && v && spotlight.has(v))
              const mood = shown && verdict === 'blockbuster' ? 'cheer' : shown && verdict === 'plottwist' ? 'shock' : !v && current && !shown ? 'thinking' : 'idle'
              const seat = (
                <button className="relative" disabled={m.id === me?.id}>
                  <Avatar character={m.character} size={72} mood={mood} />
                  {room?.hostId === m.id && <span className="absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-background shadow"><Crown className="h-3.5 w-3.5 text-amber-500" /></span>}
                  {v && !shown && <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white"><Check className="h-3 w-3" /></span>}
                </button>
              )
              return (
                <div key={m.id} data-seat={m.id} className="relative flex flex-col items-center gap-2" style={{ marginTop: Math.abs(i - (here.length - 1) / 2) * 6 }}>
                  {isSpot && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute -inset-6 -top-16 rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,.55), transparent 70%)' }} />}
                  {m.id === me?.id ? seat : (
                    <Popover>
                      <PopoverTrigger asChild>{seat}</PopoverTrigger>
                      <PopoverContent className="w-auto p-1.5 flex items-center gap-1">
                        {['💵', '🪙', '🍅', '🌹', '☕'].map((it) => (
                          <Button key={it} variant="ghost" size="icon" className="text-xl" onClick={() => actions.send({ kind: 'throw', from: me!.id, to: m.id, item: it })}>{it}</Button>
                        ))}
                        {isHost && <><Separator orientation="vertical" className="h-6 mx-1" /><Button variant="ghost" size="sm" onClick={() => actions.makeHost(m.id)}><Crown /> Make host</Button></>}
                      </PopoverContent>
                    </Popover>
                  )}
                  <SeatCard value={v} faceUp={shown} delay={i * 0.08} color={c.color} />
                  <div className="text-center leading-tight">
                    <div className="text-sm font-semibold text-white drop-shadow">{m.name}{m.id === me?.id ? ' (you)' : ''}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/80">{c.name}</div>
                  </div>
                  {isSpot && <Badge variant="destructive" className="uppercase tracking-wider">Make your case</Badge>}
                </div>
              )
            })}
          </section>
          {room && !hostHere && <div className="text-center"><Button variant="outline" size="sm" onClick={actions.claimHost}><Crown /> No host right now. Run this job</Button></div>}

          {/* Results + host controls */}
          {current && (
            <div className="flex flex-col items-center gap-3 mt-auto">
              {shown && result && <Results result={result} />}
              {isHost ? (
                <div className="flex flex-wrap gap-2 justify-center items-center">
                  {!room?.revealed && <Button size="lg" disabled={roundVotes.length === 0} onClick={actions.reveal}><Eye /> Show the cards <Badge variant="secondary" className="ml-1">{roundVotes.length}/{here.length}</Badge></Button>}
                  {shown && <>
                    <span className="text-sm text-muted-foreground mr-1">Lock it in</span>
                    {NUMERIC.map((n) => <Button key={n} size="sm" className="w-10 font-mono" variant={n === result?.suggested ? 'default' : 'outline'} onClick={() => actions.lockIn(n)}>{n}</Button>)}
                    <Separator orientation="vertical" className="h-6 mx-1" />
                    <Button variant="ghost" size="sm" onClick={actions.revote}><RotateCcw /> Revote</Button>
                  </>}
                </div>
              ) : !room?.revealed && <p className="text-sm text-muted-foreground">{roundVotes.length}/{here.length} in · the host shows the cards</p>}
            </div>
          )}

          {/* Hand */}
          {me?.status === 'here' ? (
            <div className="flex justify-center gap-3 pb-2 pt-2">
              {DECK.map((v) => <TicketCard key={v} value={v} color={me ? castById(me.character).color : undefined} selected={myVote === v} disabled={!current || !!room?.revealed} onClick={() => { sfx.pick(); actions.vote(v) }} />)}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 pb-4 text-sm text-muted-foreground">You're marked away, so you're watching. <Button size="sm" onClick={() => actions.setStatus('here')}>Take my seat</Button></div>
          )}
        </main>
      </div>

      <Throws api={api} />
      <AnimatePresence>{phase === 'countdown' && <Countdown onDone={finishCountdown} />}</AnimatePresence>
      <AnimatePresence>{verdict && verdict !== 'none' && <Verdict outcome={verdict} points={result?.suggested ?? ''} />}</AnimatePresence>
      <LoadStories api={api} open={showLoad} onClose={() => setShowLoad(false)} />
      <NewSprint api={api} open={showNewSprint} onClose={() => setShowNewSprint(false)} />
      {creditsFor && <Credits api={api} sprint={sprints.find((s) => s.id === creditsFor)!} onClose={() => setCreditsFor(null)} />}
    </div>
  )
}

function Results({ result }: { result: NonNullable<RoomApi['result']> }) {
  const entries = DECK.filter((v) => result.counts[v])
  const max = Math.max(...entries.map((v) => result.counts[v]), 1)
  return (
    <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <Card><CardContent className="px-5 py-3 flex items-end gap-6">
        <div><div className="label">Average</div><div className="text-2xl font-semibold tabular-nums">{result.average ?? '–'}</div></div>
        <div><div className="label">Crew pick</div><div className="text-2xl font-semibold text-accent tabular-nums">{result.suggested ?? '–'}</div></div>
        <Separator orientation="vertical" className="h-12" />
        <div className="flex items-end gap-2 h-14">
          {entries.map((v) => (
            <div key={v} className="flex flex-col items-center gap-1">
              <motion.div initial={{ height: 0 }} animate={{ height: (result.counts[v] / max) * 36 }} className="w-6 rounded-sm bg-primary" />
              <div className="text-xs font-mono">{label(v)}<span className="text-muted-foreground">×{result.counts[v]}</span></div>
            </div>
          ))}
        </div>
      </CardContent></Card>
    </motion.div>
  )
}
