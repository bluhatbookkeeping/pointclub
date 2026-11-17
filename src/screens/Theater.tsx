import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Clapperboard, Crown, ExternalLink, FolderOpen, Link2, RotateCcw, Volume2, VolumeX, UserRound, Eye, Check, Circle, MessageSquare, MessageSquareOff, ArrowRight, SkipForward, ListChecks, Undo2 } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { PokerTable } from '@/components/PokerTable'
import { TicketCard, label } from '@/components/TicketCard'
import { Celebration, Countdown, Verdict } from '@/components/RevealFx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Throws } from '@/components/Throws'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { LoadStories } from './LoadStories'
import { NewSprint } from './NewSprint'
import { Credits } from './Credits'
import { CAST, castById } from '@/lib/cast'
import { setVoicesEnabled, voice, voicesEnabled } from '@/lib/voice'
import { blockbusterBurst, clearFx, sparkleBurst } from '@/lib/fx'
import { isMuted, setMuted, sfx } from '@/lib/sounds'
import { cn } from '@/lib/utils'
import { DECK, NUMERIC, Outcome } from '@/lib/types'
import { isOpen, type RoomApi } from '@/lib/useRoom'

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
  const [voices, setVoices] = useState(voicesEnabled())
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

  useEffect(() => { voice.preload(CAST.map((c) => c.id)) }, [])

  // A crew member's voice line plays on every screen when they put down a card (not on first load).
  const seenVotes = useRef<{ key: string; ids: Set<string> } | null>(null)
  useEffect(() => {
    const ids = new Set(roundVotes.map((v) => v.id))
    const seen = seenVotes.current
    if (seen && seen.key === key && !room?.revealed) {
      for (const v of roundVotes) if (!seen.ids.has(v.id)) {
        const m = members.find((x) => x.id === v.memberId)
        if (m) voice.vote(m.character)
      }
    }
    seenVotes.current = { key, ids }
  }, [roundVotes, key, room?.revealed, members])

  // The narrator reacts when the host locks in points.
  const seenPoints = useRef<Map<string, string | null> | null>(null)
  useEffect(() => {
    const now = new Map(lineup.map((s) => [s.id, s.points] as const))
    const before = seenPoints.current
    if (before) for (const [id, pts] of now) if (pts && !before.get(id)) voice.lockedIn(pts)
    seenPoints.current = now
  }, [lineup])

  useEffect(() => { if (phase === 'countdown') voice.reveal() }, [phase])

  // "Let's vote." when the room moves to a new story that still needs points (not on first load).
  const lastStory = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const id = current?.id ?? null
    if (lastStory.current !== undefined && id && id !== lastStory.current && !current?.points) voice.nextStory()
    lastStory.current = id
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const finishCountdown = () => {
    setPhase('shown')
    const o = result?.outcome ?? 'none'
    setVerdict(o)
    if (o === 'blockbuster') { voice.cleanJob(); blockbusterBurst() }
    else if (o === 'critics') { sfx.sparkle(); voice.closeEnough(); sparkleBurst() }
    else if (o === 'plottwist') { clearFx(); voice.compromised() }
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
  const nextUnpointed = lineup.find((s) => isOpen(s) && s.id !== current?.id && s.order > (current?.order ?? -1)) ?? lineup.find((s) => isOpen(s) && s.id !== current?.id)
  const skippedCount = lineup.filter((s) => s.skipped).length
  const allDone = lineup.length > 0 && !current && !lineup.some(isOpen)
  const [skipNote, setSkipNote] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const [agendaCopied, setAgendaCopied] = useState(false)
  // Celebrate once when the last story is finished (not when the page loads already done).
  const wasDone = useRef<boolean | null>(null)
  useEffect(() => {
    if (wasDone.current === false && allDone) { setCelebrate(true); voice.done(); blockbusterBurst() }
    wasDone.current = allDone
  }, [allDone])
  const copyAgenda = () => {
    const u = new URL(location.href); u.searchParams.delete('p'); u.searchParams.set('agenda', '1')
    navigator.clipboard?.writeText(u.toString()).then(() => { setAgendaCopied(true); setTimeout(() => setAgendaCopied(false), 1800) })
  }
  const totalPts = lineup.reduce((s, x) => s + (Number(x.points) || 0), 0)
  const hostHere = !!room && members.some((m) => m.id === room.hostId && m.status === 'here')

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-3 px-4 whitespace-nowrap">
          <Logo />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-medium">{activeSprint?.name}</span>
            {activeSprint?.title && <span className="hidden truncate text-muted-foreground 2xl:inline">{activeSprint.title}</span>}
            <Badge variant="secondary" className="whitespace-nowrap">{pointedCount}/{lineup.length} pointed · {totalPts} pts</Badge>
            {mode === 'local' && <Tooltip><TooltipTrigger asChild><Badge variant="destructive" className="whitespace-nowrap">Demo mode</Badge></TooltipTrigger><TooltipContent className="max-w-xs whitespace-normal">Team mode is off, so only tabs in this browser share the room. On Vercel, set VITE_BACKEND = api and redeploy.</TooltipContent></Tooltip>}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {isHost && <Button variant="outline" size="sm" onClick={() => setShowLoad(true)} title="Add stories"><Camera /><span className="hidden lg:inline">Add stories</span></Button>}
            {isHost && <Button variant="outline" size="sm" onClick={() => setShowNewSprint(true)} title="Wrap the sprint"><Clapperboard /><span className="hidden lg:inline">Wrap sprint</span></Button>}
            {isHost && <Button variant="ghost" size="sm" onClick={copyAgenda} title="Copy a read-only link to this sprint's story list to send before the meeting">{agendaCopied ? <Check /> : <ListChecks />}<span className="hidden lg:inline">{agendaCopied ? 'Agenda link copied' : 'Share agenda'}</span></Button>}
            <Button variant="ghost" size="sm" onClick={openVault} title="Case Files (sprint history)"><FolderOpen /><span className="hidden lg:inline">Case Files</span></Button>
            <IconBtn tip={copied ? 'Copied!' : 'Copy room link'} onClick={copyLink}>{copied ? <Check /> : <Link2 />}</IconBtn>
            <IconBtn tip={voices ? 'Turn crew voices off' : 'Turn crew voices on'} onClick={() => { setVoicesEnabled(!voices); setVoices(!voices) }}>{voices ? <MessageSquare /> : <MessageSquareOff />}</IconBtn>
            <IconBtn tip={muted ? 'Unmute' : 'Mute'} onClick={() => { setMuted(!muted); setMute(!muted) }}>{muted ? <VolumeX /> : <Volume2 />}</IconBtn>
            <IconBtn tip="My seat (lobby)" onClick={onLobby}>{me ? <Avatar character={me.character} name={me.name} size={26} /> : <UserRound />}</IconBtn>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden p-3">
            <div className="label px-2 mb-2">Stories</div>
            {lineup.length === 0 && <p className="text-sm text-muted-foreground px-2">No stories yet. {isHost ? 'Click “Add stories” to add them from a screenshot or a list.' : 'Waiting for the host.'}</p>}
            <nav className="grid gap-0.5">
              {lineup.map((s) => (
                <button key={s.id} onClick={() => isHost && actions.selectStory(s.id)} disabled={!isHost}
                  title={s.points ? `Done: ${s.points} points. Click to view or revote.` : s.skipped ? `Skipped, moves to next sprint${s.note ? `: ${s.note}` : ''}` : s.note || undefined}
                  className={cn('group flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:cursor-default',
                    s.id === current?.id ? 'bg-secondary font-medium' : 'hover:bg-secondary/60 text-muted-foreground',
                    (s.points || s.skipped) && s.id !== current?.id && 'opacity-55')}>
                  {s.points ? <Check className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                    : s.skipped ? <SkipForward className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />}
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-xs text-muted-foreground">#{s.number}</span>
                    <span className={cn('block line-clamp-2 break-words leading-snug', s.id === current?.id && 'text-foreground')} title={s.title}>{s.title}</span>
                  </span>
                  {s.points && <Badge variant="secondary" className="font-mono">{label(s.points)}</Badge>}
                  {s.skipped && !s.points && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Skipped</Badge>}
                </button>
              ))}
            </nav>
            {away.length > 0 && <>
              <Separator className="my-4" />
              <div className="label px-2 mb-2">Away</div>
              <div className="grid gap-1 px-2">{away.map((m) => <div key={m.id} className="flex items-center gap-2 text-sm text-muted-foreground"><Avatar character={m.character} name={m.name} size={22} dim /> {m.name}</div>)}</div>
            </>}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 flex flex-col gap-4 p-6">
          <Card>
            <CardContent className="px-5 py-4 flex items-start gap-4">
              {current ? <>
                <div className="flex-1 min-w-0">
                  <div className="label"><span className="text-accent">Now pointing</span> · Story {lineup.findIndex((s) => s.id === current.id) + 1} of {lineup.length}{room && room.round > 1 ? ` · Revote ${room.round - 1}` : ''}</div>
                  <h1 className={cn('mt-1 font-semibold tracking-tight break-words line-clamp-3', current.title.length > 70 ? 'text-lg' : 'text-2xl')} title={current.title}>
                    <span className="font-mono text-accent">#{current.number}</span> {current.title}
                  </h1>
                  {current.note && <p className="mt-1 text-sm text-amber-800">Note: {current.note}</p>}
                </div>
                {current.url ? <Button variant="outline" className="shrink-0" onClick={openAdo}>Open in ADO <ExternalLink /></Button>
                  : isHost ? <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => setShowLoad(true)}>Add ADO link</Button> : null}
              </> : allDone ? (
                <div className="flex flex-1 flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="label text-emerald-700">All stories done</div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight">{pointedCount} pointed · {totalPts} points</div>
                    {skippedCount > 0 && <div className="text-sm text-amber-800">{skippedCount} skipped · moves to next sprint when you wrap</div>}
                  </div>
                  {isHost && <Button variant="outline" onClick={() => setShowLoad(true)}><Camera /> Add more stories</Button>}
                  {isHost && <Button onClick={() => setShowNewSprint(true)}><Clapperboard /> Wrap sprint</Button>}
                </div>
              ) : <div className="flex flex-1 items-center gap-4"><span className="flex-1 text-muted-foreground">{lineup.length ? 'Pick a story on the left to start.' : isHost ? 'No stories yet. Add some to start.' : 'Waiting for the host…'}</span>
                  {isHost && !lineup.length && <Button onClick={() => setShowLoad(true)}><Camera /> Add stories</Button>}
                  {isHost && lineup.length > 0 && nextUnpointed && <Button onClick={() => actions.selectStory(nextUnpointed.id)}>Start with #{nextUnpointed.number} <ArrowRight /></Button>}
                </div>}
            </CardContent>
          </Card>

          {/* The table */}
          <PokerTable faceUp={shown} votesIn={roundVotes.length} center={shown && result ? <Results result={result} /> : undefined} seats={here.map((m) => {
            const v = voteOf(m.id)
            return {
              member: m, vote: v, isMe: m.id === me?.id, isHost: room?.hostId === m.id,
              spotlight: !!(spotlight && v && spotlight.has(v)),
              mood: shown && verdict === 'blockbuster' ? 'cheer' : shown && verdict === 'plottwist' ? 'shock' : !v && current && !shown ? 'thinking' : 'idle',
              menu: m.id === me?.id ? undefined : <>
                {['💵', '🪙', '🍅', '🌹', '☕'].map((it) => <Button key={it} variant="ghost" size="icon" className="text-xl" onClick={() => actions.send({ kind: 'throw', from: me!.id, to: m.id, item: it })}>{it}</Button>)}
                {isHost && <><Separator orientation="vertical" className="h-6 mx-1" /><Button variant="ghost" size="sm" onClick={() => actions.makeHost(m.id)}><Crown /> Make host</Button></>}
              </>,
            }
          })} />
          {room && !hostHere && <div className="text-center"><Button variant="outline" size="sm" onClick={actions.claimHost}><Crown /> No host right now. Run this job</Button></div>}

          {/* Results + host controls */}
          {current && current.points && !room?.revealed && (
            // A story that already has points: voting is locked until someone chooses to revote it.
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Badge variant="secondary" className="px-3 py-1 text-sm"><Check className="mr-1 h-4 w-4 text-emerald-600" /> Done · <span className="ml-1 font-mono font-semibold">{label(current.points)}</span>&nbsp;points</Badge>
              {isHost && <Button variant="outline" size="sm" onClick={actions.revoteStory}><RotateCcw /> Revote this story</Button>}
              {isHost && nextUnpointed && <Button size="sm" onClick={() => actions.selectStory(nextUnpointed.id)}>Next story <ArrowRight /></Button>}
            </div>
          )}
          {current && current.skipped && !current.points && (
            // Parked for next sprint: show why, and let the host bring it back now.
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Badge variant="outline" className="border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-800"><SkipForward className="mr-1 h-4 w-4" /> Skipped · moves to next sprint</Badge>
              {isHost && <Button variant="outline" size="sm" onClick={actions.unskipStory}><Undo2 /> Point it now</Button>}
              {isHost && nextUnpointed && <Button size="sm" onClick={() => actions.selectStory(nextUnpointed.id)}>Next story <ArrowRight /></Button>}
            </div>
          )}
          {current && !current.points && !current.skipped && (
            <div className="flex flex-col items-center gap-3">
              {isHost ? (
                <div className="flex flex-wrap gap-2 justify-center items-center">
                  {!room?.revealed && <Button size="lg" disabled={roundVotes.length === 0} onClick={actions.reveal}><Eye /> Show the cards <Badge variant="secondary" className="ml-1">{roundVotes.length}/{here.length}</Badge></Button>}
                  <Popover onOpenChange={(o) => o && setSkipNote(current.note ?? '')}>
                    <PopoverTrigger asChild><Button variant="ghost" size={room?.revealed ? 'lg' : 'lg'} className="text-muted-foreground"><SkipForward /> Skip · needs more info</Button></PopoverTrigger>
                    <PopoverContent className="w-80">
                      <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); actions.skipStory(skipNote) }}>
                        <div className="text-sm font-medium">Skip this story for now?</div>
                        <p className="text-xs text-muted-foreground">It moves to next sprint's list when you wrap. Add a note so you remember why.</p>
                        <Input autoFocus placeholder="e.g. Waiting on API details from Sam" value={skipNote} onChange={(e) => setSkipNote(e.target.value)} maxLength={300} />
                        <Button type="submit" size="sm">Skip &amp; next story <ArrowRight /></Button>
                      </form>
                    </PopoverContent>
                  </Popover>
                  {shown && result?.suggested && <>
                    <Button size="lg" onClick={() => actions.lockIn(result.suggested!)}>
                      Save {result.suggested} {result.suggested === '1' ? 'point' : 'points'} · {nextUnpointed ? 'Next story' : 'Finish'} <ArrowRight />
                    </Button>
                    <Button variant="outline" size="lg" onClick={actions.revote}><RotateCcw /> Revote</Button>
                  </>}
                  {shown && !result?.suggested && <Button size="lg" variant="outline" onClick={actions.revote}><RotateCcw /> No numbers yet · Revote</Button>}
                </div>
              ) : <p className="text-sm text-muted-foreground">{!room?.revealed ? `${roundVotes.length}/${here.length} voted · the host shows the cards` : 'Waiting for the host to save the points…'}</p>}
              {isHost && shown && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  Or save a different number:
                  {NUMERIC.map((n) => <Button key={n} size="sm" variant="ghost" className="h-7 w-9 px-0 font-mono" onClick={() => actions.lockIn(n)}>{n}</Button>)}
                </div>
              )}
            </div>
          )}

          {/* Hand */}
          {!current || current.points || current.skipped ? null : me?.status === 'here' ? (
            <div className="flex justify-center gap-3 pb-2 pt-2">
              {DECK.map((v) => <TicketCard key={v} value={v} color={me ? castById(me.character).color : undefined} selected={myVote === v} disabled={!current || !!current.points || !!room?.revealed} onClick={() => { sfx.pick(); actions.vote(v) }} />)}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 pb-4 text-sm text-muted-foreground">You're marked away, so you're watching. <Button size="sm" onClick={() => actions.setStatus('here')}>Take my seat</Button></div>
          )}
        </main>
      </div>

      <Throws api={api} />
      <AnimatePresence>{phase === 'countdown' && <Countdown onDone={finishCountdown} />}</AnimatePresence>
      <AnimatePresence>{verdict && verdict !== 'none' && <Verdict outcome={verdict} points={result?.suggested ?? ''} />}</AnimatePresence>
      <AnimatePresence>{celebrate && <Celebration points={totalPts} stories={pointedCount} skipped={skippedCount} onClose={() => setCelebrate(false)} />}</AnimatePresence>
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
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6 }}>
      <Card className="bg-background/95"><CardContent className="px-5 py-3 flex items-end gap-6">
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
