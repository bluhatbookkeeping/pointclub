import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Clapperboard, Crown, ExternalLink, FolderOpen, Link2, RotateCcw, Volume2, VolumeX, UserRound, Eye, Check, Circle, MessageSquare, MessageSquareOff, ArrowRight, SkipForward, ListChecks, Undo2, Plus, Minus, Trash2, Mail, ArrowUpToLine } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { PokerTable } from '@/components/PokerTable'
import { TicketCard, label } from '@/components/TicketCard'
import { Celebration, Countdown, Verdict } from '@/components/RevealFx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Throws } from '@/components/Throws'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SortableList } from '@/components/SortableList'
import { NewSprint } from './NewSprint'
import { Credits } from './Credits'
import { CAST, castById } from '@/lib/cast'
import { setVoicesEnabled, voice, voicesEnabled } from '@/lib/voice'
import { blockbusterBurst, clearFx, sparkleBurst } from '@/lib/fx'
import { isMuted, setMuted, sfx } from '@/lib/sounds'
import { cn, sessionName } from '@/lib/utils'
import { DECK, NUMERIC, Outcome } from '@/lib/types'
import { isOpen, type RoomApi } from '@/lib/useRoom'

type Phase = 'voting' | 'countdown' | 'shown'

function IconBtn({ tip, children, ...p }: React.ComponentProps<typeof Button> & { tip: string }) {
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={tip} {...p}>{children}</Button></TooltipTrigger><TooltipContent>{tip}</TooltipContent></Tooltip>
}

export function Theater({ api, openVault, openPlanner, onLobby }: { api: RoomApi; openVault: () => void; openPlanner: () => void; onLobby: () => void }) {
  const { room, members, me, current, lineup, backlog, upNext, isDealer, roundVotes, myVote, isHost, result, actions, activeSprint, sprints, mode } = api
  // A seat shows only for people who have the table open right now (their screen checks in every 30 seconds).
  // Teammates who joined in an earlier week but haven't opened the link today are listed as "Not here yet".
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t) }, [])
  const ONLINE_MS = 3 * 60_000
  const isOnline = (m: { id: string; lastSeen: number }) => m.id === me?.id || now - (m.lastSeen || 0) < ONLINE_MS
  const here = members.filter((m) => m.status === 'here' && isOnline(m)).sort((a, b) => a.name.localeCompare(b.name))
  const notYet = members.filter((m) => m.status === 'here' && !isOnline(m)).sort((a, b) => a.name.localeCompare(b.name))
  // Who votes: everyone here except the dealer (the host), unless the host turned on "Vote too".
  const voters = here.filter((m) => room?.hostVotes || m.id !== room?.hostId)
  const allIn = voters.length > 0 && voters.every((m) => roundVotes.some((v) => v.memberId === m.id))
  const away = members.filter((m) => m.status === 'away')
  const [phase, setPhase] = useState<Phase>(room?.revealed ? 'shown' : 'voting')
  const [verdict, setVerdict] = useState<Outcome | null>(null)
  const [muted, setMute] = useState(isMuted())
  const [voices, setVoices] = useState(voicesEnabled())
  const [invite, setInvite] = useState<string | null>(null)
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

  // A teammate's voice line plays on every screen when they put down a card (not on first load).
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
  const roomLink = () => { const u = new URL(location.href); u.searchParams.delete('p'); u.searchParams.delete('agenda'); return u.toString() }
  /** Ready-to-send invite: the session's stories with ADO links, plus the join and agenda links. */
  const inviteEmail = () => {
    const agenda = new URL(roomLink()); agenda.searchParams.set('agenda', '1')
    const open = lineup.filter((s) => !s.points)
    const list = open.length ? open : upNext
    return [
      'Hi team,',
      '',
      `Here are the stories we'll point in our next session${activeSprint ? ` (${sessionName(activeSprint.name)})` : ''}:`,
      '',
      ...(list.length ? list.map((s, i) => `${i + 1}. #${s.number} ${s.title}${s.url ? `\n   ${s.url}` : ''}${s.note ? `\n   Note: ${s.note}` : ''}`) : ['(No stories picked yet.)']),
      '',
      'Please read through them before the meeting.',
      '',
      `Join the pointing session: ${roomLink()}`,
      `Story list only: ${agenda.toString()}`,
      '',
      'Thanks!',
    ].join('\n')
  }
  const copyAgenda = () => {
    const u = new URL(location.href); u.searchParams.delete('p'); u.searchParams.set('agenda', '1')
    navigator.clipboard?.writeText(u.toString()).then(() => { setAgendaCopied(true); setTimeout(() => setAgendaCopied(false), 1800) })
  }
  const totalPts = lineup.reduce((s, x) => s + (Number(x.points) || 0), 0)
  const hostHere = !!room && here.some((m) => m.id === room.hostId)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-3 px-4 whitespace-nowrap">
          <Logo />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-medium">{sessionName(activeSprint?.name)}</span>
            {activeSprint?.title && <span className="hidden truncate text-muted-foreground 2xl:inline">{activeSprint.title}</span>}
            <Badge variant="secondary" className="whitespace-nowrap">{pointedCount}/{lineup.length} pointed · {totalPts} pts</Badge>
            {mode === 'local' && <Tooltip><TooltipTrigger asChild><Badge variant="destructive" className="whitespace-nowrap">Demo mode</Badge></TooltipTrigger><TooltipContent className="max-w-xs whitespace-normal">Team mode is off, so only tabs in this browser share the room. This only happens when running Point Club on your own computer.</TooltipContent></Tooltip>}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {isHost && <Button variant="outline" size="sm" onClick={openPlanner} title="Plan stories: add stories, rank the backlog, pick the next session"><ListChecks /><span className="hidden lg:inline">Plan stories</span></Button>}
            {isHost && <Button variant="outline" size="sm" onClick={() => setShowNewSprint(true)} title="Finish this session and save it to Past stories"><Clapperboard /><span className="hidden lg:inline">Finish session</span></Button>}
            {isHost && (
              <Popover onOpenChange={(o) => o && setInvite(inviteEmail())}>
                <PopoverTrigger asChild><Button variant="ghost" size="sm" title="Copy an email inviting the team, with this session's stories and links"><Mail /><span className="hidden lg:inline">Invite team</span></Button></PopoverTrigger>
                <PopoverContent align="end" className="w-[30rem] grid gap-2">
                  <div className="text-sm font-medium">Invite the team</div>
                  <p className="text-xs text-muted-foreground">Copy this into an email or chat. It lists this session's stories with links, plus the join link.</p>
                  <Textarea readOnly className="h-56 font-mono text-xs" value={invite ?? ''} onFocus={(e) => e.currentTarget.select()} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => navigator.clipboard?.writeText(invite ?? '').then(() => { setAgendaCopied(true); setTimeout(() => setAgendaCopied(false), 1800) })}>{agendaCopied ? <Check /> : <Mail />} {agendaCopied ? 'Copied' : 'Copy email text'}</Button>
                    <Button size="sm" variant="outline" asChild><a href={`mailto:?subject=${encodeURIComponent(`Story pointing: ${sessionName(activeSprint?.name) || 'this week'}`)}&body=${encodeURIComponent(invite ?? '')}`}>Open in email app</a></Button>
                    <Button size="sm" variant="ghost" onClick={copyAgenda}><ListChecks /> Copy agenda link</Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button variant="ghost" size="sm" onClick={openVault} title="Past stories (every session's stories and votes)"><FolderOpen /><span className="hidden lg:inline">Past stories</span></Button>
            <IconBtn tip={copied ? 'Copied!' : 'Copy room link'} onClick={copyLink}>{copied ? <Check /> : <Link2 />}</IconBtn>
            <IconBtn tip={voices ? 'Turn voice lines off' : 'Turn voice lines on'} onClick={() => { setVoicesEnabled(!voices); setVoices(!voices) }}>{voices ? <MessageSquare /> : <MessageSquareOff />}</IconBtn>
            <IconBtn tip={muted ? 'Unmute' : 'Mute'} onClick={() => { setMuted(!muted); setMute(!muted) }}>{muted ? <VolumeX /> : <Volume2 />}</IconBtn>
            <IconBtn tip="My seat (lobby)" onClick={onLobby}>{me ? <Avatar character={me.character} name={me.name} size={26} /> : <UserRound />}</IconBtn>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden p-3">
            <div className="mb-2 flex items-baseline justify-between px-2">
              <span className="label" data-testid="session-label">{(() => { const done = lineup.filter((x) => x.points).length; const n = lineup.length
                const nm = activeSprint ? sessionName(activeSprint.name) : 'Refinement session'
                return n === 0 ? nm : `${nm} · ${done} of ${n} pointed` })()}</span>
            </div>
            {lineup.length === 0 && <p className="text-sm text-muted-foreground px-2">{isHost ? (upNext.length ? `${upNext.length} ${upNext.length === 1 ? 'story is' : 'stories are'} waiting in Next session.` : 'Pick stories on the Plan stories page.') : 'Waiting for the host to pick stories.'}</p>}
            <nav className="grid gap-0.5">
              <SortableList items={lineup} enabled={isHost} canDrag={(s) => !s.points && !s.skipped} onReorder={actions.reorder}
                renderItem={(s, _i, handle) => (
                <div role="button" tabIndex={isHost ? 0 : -1} onClick={() => isHost && actions.selectStory(s.id)} data-testid="session-row"
                  onKeyDown={(e) => { if (isHost && e.key === 'Enter') actions.selectStory(s.id) }}
                  title={s.points ? `Done: ${s.points} points. Click to view or revote.` : s.skipped ? `Skipped, back in the backlog${s.note ? `: ${s.note}` : ''}` : s.note || undefined}
                  className={cn('group flex items-start gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm transition-colors', isHost ? 'cursor-pointer' : 'cursor-default',
                    s.id === current?.id ? 'bg-secondary font-medium' : 'hover:bg-secondary/60 text-muted-foreground',
                    (s.points || s.skipped) && s.id !== current?.id && 'opacity-55')}>
                  {isHost && handle}
                  {s.points ? <Check className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                    : s.skipped ? <SkipForward className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />}
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono text-xs text-muted-foreground">#{s.number}</span>
                    <span className={cn('block line-clamp-2 break-words leading-snug', s.id === current?.id && 'text-foreground')} title={s.title}>{s.title}</span>
                    {isHost && !s.url && !s.points && <span className="block text-[11px] text-amber-700">No ADO link</span>}
                  </span>
                  {s.points && <Badge variant="secondary" className="font-mono">{label(s.points)}</Badge>}
                  {s.skipped && !s.points && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Skipped</Badge>}
                  {isHost && !s.points && <span role="button" tabIndex={0} title="Move back to backlog" className="mt-0.5 hidden text-muted-foreground/60 hover:text-foreground group-hover:inline"
                    onClick={(e) => { e.stopPropagation(); actions.moveToBacklog(s.id) }}><Undo2 className="h-3.5 w-3.5" /></span>}
                </div>
              )} />
            </nav>
            <button onClick={openPlanner} className="mt-3 w-full rounded-md border border-dashed px-2 py-2 text-left text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground" data-testid="backlog-link">
              Backlog: {backlog.length} {backlog.length === 1 ? 'story' : 'stories'} · <span className="font-medium text-primary">Plan stories →</span>
            </button>
            {notYet.length > 0 && <>
              <Separator className="my-4" />
              <div className="label px-2 mb-2">Not here yet</div>
              <div className="grid gap-1 px-2" data-testid="not-yet">{notYet.map((m) => <div key={m.id} className="flex items-center gap-2 text-sm text-muted-foreground"><Avatar character={m.character} name={m.name} size={22} dim /> {m.name}</div>)}</div>
            </>}
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
                  : isHost ? (
                    <Popover>
                      <PopoverTrigger asChild><Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground">Add ADO link</Button></PopoverTrigger>
                      <PopoverContent align="end" className="w-96">
                        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); const url = String(new FormData(e.currentTarget).get('url') ?? '').trim(); if (url) actions.editStory({ ...current, url }) }}>
                          <div className="text-sm font-medium">ADO link for #{current.number}</div>
                          <Input name="url" autoFocus placeholder="Paste the story's link from ADO" />
                          <Button type="submit" size="sm">Save link</Button>
                        </form>
                      </PopoverContent>
                    </Popover>
                  ) : null}
              </> : allDone ? (
                <div className="flex flex-1 flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="label text-emerald-700">All stories done</div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight">{pointedCount} pointed · {totalPts} points</div>
                    {skippedCount > 0 && <div className="text-sm text-amber-800">{skippedCount} skipped · back in the backlog with notes</div>}
                  </div>
                  {isHost && <Button variant="outline" onClick={openPlanner}><ListChecks /> Plan stories</Button>}
                  {isHost && <Button onClick={() => setShowNewSprint(true)}><Clapperboard /> Finish session</Button>}
                </div>
              ) : <div className="flex flex-1 items-center gap-4"><span className="flex-1 text-muted-foreground">{lineup.length ? 'Pick a story on the left to start.' : isHost ? (upNext.length ? `${upNext.length} ${upNext.length === 1 ? 'story is' : 'stories are'} ready in Next session.` : backlog.length ? 'Pick the stories for this meeting on the Plan stories page.' : 'No stories yet. Add some to start.') : 'Waiting for the host…'}</span>
                  {isHost && !lineup.length && (upNext.length
                    ? <Button onClick={() => actions.putOnTable()} data-testid="table-put">Put {upNext.length} {upNext.length === 1 ? 'story' : 'stories'} on the table <ArrowRight /></Button>
                    : <Button onClick={openPlanner}><ListChecks /> Plan stories <ArrowRight /></Button>)}
                  {isHost && lineup.length > 0 && nextUnpointed && <Button onClick={() => actions.selectStory(nextUnpointed.id)}>Start with #{nextUnpointed.number} <ArrowRight /></Button>}
                </div>}
            </CardContent>
          </Card>

          {/* The table */}
          <PokerTable faceUp={shown} votesIn={roundVotes.length} center={shown && result ? <Results result={result} /> : undefined} seats={here.map((m) => {
            const v = voteOf(m.id)
            return {
              member: m, vote: v, isMe: m.id === me?.id, isHost: room?.hostId === m.id, dealer: room?.hostId === m.id && !room?.hostVotes,
              spotlight: !!(spotlight && v && spotlight.has(v)),
              mood: shown && verdict === 'blockbuster' ? 'cheer' : shown && verdict === 'plottwist' ? 'shock' : !v && current && !shown ? 'thinking' : 'idle',
              menu: m.id === me?.id ? undefined : <>
                {['💵', '🪙', '🍅', '🌹', '☕'].map((it) => <Button key={it} variant="ghost" size="icon" className="text-xl" onClick={() => actions.send({ kind: 'throw', from: me!.id, to: m.id, item: it })}>{it}</Button>)}
                {isHost && <><Separator orientation="vertical" className="h-6 mx-1" /><Button variant="ghost" size="sm" onClick={() => actions.makeHost(m.id)}><Crown /> Make host</Button></>}
              </>,
            }
          })} />
          {room && !hostHere && <div className="text-center"><Button variant="outline" size="sm" onClick={actions.claimHost}><Crown /> No host right now. Be the host</Button></div>}

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
            // Skipped this session: show why, and let the host bring it back now.
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Badge variant="outline" className="border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-800"><SkipForward className="mr-1 h-4 w-4" /> Skipped · back in the backlog{current.note ? `: ${current.note}` : ''}</Badge>
              {isHost && <Button variant="outline" size="sm" onClick={actions.unskipStory}><Undo2 /> Point it now</Button>}
              {isHost && nextUnpointed && <Button size="sm" onClick={() => actions.selectStory(nextUnpointed.id)}>Next story <ArrowRight /></Button>}
            </div>
          )}
          {current && !current.points && !current.skipped && (
            <div className="flex flex-col items-center gap-3">
              {isHost ? (
                <div className="flex flex-wrap gap-2 justify-center items-center">
                  {!room?.revealed && <Button size="lg" disabled={roundVotes.length === 0} onClick={actions.reveal} className={cn(allIn && 'animate-pulse ring-4 ring-primary/30')} data-testid="show-hand"><Eye /> Show hand <Badge variant="secondary" className="ml-1">{roundVotes.length}/{voters.length}</Badge></Button>}
                  <Popover onOpenChange={(o) => o && setSkipNote(current.note ?? '')}>
                    <PopoverTrigger asChild><Button variant="ghost" size={room?.revealed ? 'lg' : 'lg'} className="text-muted-foreground"><SkipForward /> Skip · needs more info</Button></PopoverTrigger>
                    <PopoverContent className="w-80">
                      <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); actions.skipStory(skipNote) }}>
                        <div className="text-sm font-medium">Skip this story for now?</div>
                        <p className="text-xs text-muted-foreground">It goes straight back to the top of the backlog with this note, for your next backlog refinement.</p>
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
              ) : <p className="text-sm text-muted-foreground">{!room?.revealed ? `${roundVotes.length}/${voters.length} voted · the dealer shows the hand` : 'Waiting for the host to save the points…'}</p>}
              {isHost && shown && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-muted-foreground">
                  Or save a different number:
                  {NUMERIC.map((n) => <Button key={n} size="sm" variant="ghost" className="h-7 w-9 px-0 font-mono" onClick={() => actions.lockIn(n)}>{n}</Button>)}
                </div>
              )}
            </div>
          )}

          {/* Hand */}
          {!current || current.points || current.skipped ? null : isDealer ? (
            <div className="flex flex-wrap items-center justify-center gap-3 pb-4 text-sm text-muted-foreground" data-testid="dealer-panel">
              <span>You're the dealer: the team votes, you show the hand.</span>
              <span className="font-medium text-foreground">{allIn ? 'All cards are in.' : `${roundVotes.length} of ${voters.length} cards in.`}</span>
              <Button size="sm" variant="ghost" onClick={() => actions.setHostVotes(true)}>Vote too</Button>
            </div>
          ) : me?.status === 'here' ? (
            <div className="grid justify-items-center gap-1 pb-2 pt-2">
            {isHost && <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => actions.setHostVotes(false)}>Just deal, don't vote</Button>}
            <div className="flex justify-center gap-3">
              {DECK.map((v) => <TicketCard key={v} value={v} color={me ? castById(me.character).color : undefined} selected={myVote === v} disabled={!current || !!current.points || !!room?.revealed} onClick={() => { sfx.pick(); actions.vote(v) }} />)}
            </div>
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
        <div><div className="label">Most votes</div><div className="text-2xl font-semibold text-accent tabular-nums">{result.suggested ?? '–'}</div></div>
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
