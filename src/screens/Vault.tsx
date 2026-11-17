import { sessionDate, sessionIso, sessionName } from '@/lib/utils'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, FolderClosed, FolderOpen } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Logo } from '@/components/Logo'
import { label } from '@/components/TicketCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { sprintStats } from '@/lib/awards'
import { castById } from '@/lib/cast'
import type { RoomApi } from '@/lib/useRoom'

const OUTCOME: Record<string, { text: string; cls: string }> = {
  blockbuster: { text: 'Agreed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  critics: { text: 'Close', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  plottwist: { text: 'Split vote', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export function Vault({ api, onBack }: { api: RoomApi; onBack: () => void }) {
  const sprints = [...api.sprints].sort((a, b) => b.startedAt - a.startedAt)
  const [openId, setOpenId] = useState<string | null>(null)
  const stats = sprints.map((s) => ({ s, st: sprintStats(s, api.stories, api.votes, api.members) }))
  const maxPts = Math.max(1, ...stats.map((x) => x.st.total))
  const open = stats.find((x) => x.s.id === openId)
  // Team-wide numbers across every session with points (useful for planning capacity).
  const withPoints = stats.filter((x) => x.st.pointed.length)
  const allPointed = withPoints.flatMap((x) => x.st.pointed)
  const team = {
    velocity: withPoints.length ? Math.round(withPoints.reduce((a, x) => a + x.st.total, 0) / withPoints.length) : 0,
    perStory: allPointed.length ? Math.round((allPointed.reduce((a, s) => a + (Number(s.points) || 0), 0) / allPointed.length) * 10) / 10 : 0,
    firstTry: allPointed.length ? Math.round((allPointed.filter((s) => s.rounds === 1).length / allPointed.length) * 100) : 0,
    stories: allPointed.length,
  }
  const nameOf = (id: string) => api.members.find((m) => m.id === id)

  const exportCsv = () => {
    const rows = [['Session', 'Date', 'Session note', 'Story #', 'Title', 'Points', 'Outcome', 'Votes taken', 'Average vote', 'Lowest vote', 'Highest vote', 'Votes', 'Note', 'ADO link']]
    const outcomeText = (o: string | null) => (o && OUTCOME[o] ? OUTCOME[o].text : '')
    for (const { s, st } of stats) for (const story of st.list) {
      const vs = st.voteStats(story)
      rows.push([sessionName(s.name), sessionIso(s), s.title, story.number, story.title, story.points ?? '', outcomeText(story.outcome) || (story.skipped ? 'Skipped' : ''), String(story.rounds),
        vs ? String(vs.avg) : '', vs ? String(vs.min) : '', vs ? String(vs.max) : '',
        st.finalVotes(story).map((v) => `${nameOf(v.memberId)?.name ?? '?'}=${label(v.value)}`).join('; '), story.note ?? '', story.url])
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'point-club-history.csv'; a.click()
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-6">
          <Logo />
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /> Back to the table</Button>
          <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}><Download /> Export CSV</Button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-6 grid gap-6">
        <div><h1 className="text-3xl font-semibold tracking-tight">Past user stories</h1><p className="text-muted-foreground">Every pointing session's stories, points and votes. Click a session to see its stories.</p></div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ['Average points per session', `${team.velocity}`, 'across finished sessions'],
            ['Average story size', `${team.perStory}`, 'points per story'],
            ['Agreed on first vote', `${team.firstTry}%`, 'of stories, no revote needed'],
            ['Stories pointed', `${team.stories}`, `across ${withPoints.length} ${withPoints.length === 1 ? 'session' : 'sessions'}`],
          ].map(([k, v, sub]) => (
            <Card key={k}><CardHeader className="p-4"><CardDescription>{k}</CardDescription><CardTitle className="text-3xl tabular-nums">{v}</CardTitle><div className="text-xs text-muted-foreground">{sub}</div></CardHeader></Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Points per session</CardTitle><CardDescription>Total points saved in each session</CardDescription></CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-36">
              {[...stats].reverse().map(({ s, st }) => (
                <div key={s.id} className="flex flex-col items-center gap-1 flex-1 max-w-20">
                  <div className="text-xs tabular-nums">{st.total}</div>
                  <motion.div initial={{ height: 0 }} animate={{ height: Math.max(2, (st.total / maxPts) * 100) }} className="w-full rounded-sm bg-felt" />
                  <div className="text-[11px] text-muted-foreground truncate w-full text-center">{sessionName(s.name)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {stats.map(({ s, st }) => (
            <Card key={s.id} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setOpenId(s.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant={s.closedAt ? 'secondary' : 'default'}>{s.closedAt ? 'Finished' : 'Current session'}</Badge>
                  {s.closedAt ? <FolderClosed className="h-4 w-4 text-muted-foreground" /> : <FolderOpen className="h-4 w-4 text-muted-foreground" />}
                </div>
                <CardTitle className="pt-2">{sessionName(s.name)}</CardTitle>
                <CardDescription>{s.title ? `${s.title} · ` : ''}{sessionDate(s)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums">{st.total} <span className="text-sm font-normal text-muted-foreground">pts</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="outline">{st.pointed.length} pointed</Badge>
                  <Badge variant="outline" className={OUTCOME.blockbuster.cls}>{st.blockbusters} agreed</Badge>
                  <Badge variant="outline" className={OUTCOME.plottwist.cls}>{st.twists} split</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        {open && <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{sessionName(open.s.name)}{open.s.title ? ` · ${open.s.title}` : ''}</DialogTitle>
            <DialogDescription>
              {open.st.total} points · {open.st.pointed.length} stories · avg {open.st.avgPerStory} per story · {open.st.firstTryPct}% agreed on first vote
              {open.st.sharpshooter ? ` · Closest to the final points: ${open.st.sharpshooter.name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Story</TableHead><TableHead className="w-20">Points</TableHead><TableHead className="w-36">Average vote</TableHead><TableHead className="w-36">Result</TableHead><TableHead>Final votes</TableHead></TableRow></TableHeader>
              <TableBody>{open.st.list.map((story) => { const vs = open.st.voteStats(story); return (
                <TableRow key={story.id} className="align-top">
                  <TableCell><span className="font-mono text-xs text-muted-foreground">#{story.number}</span><br />{story.url ? <a className="underline-offset-4 hover:underline" href={story.url} target="_blank" rel="noreferrer">{story.title}</a> : story.title}</TableCell>
                  <TableCell className="font-mono text-lg">{story.points ? label(story.points) : '–'}</TableCell>
                  <TableCell className="tabular-nums">{vs ? <><span className="font-semibold">{vs.avg}</span><span className="text-xs text-muted-foreground"> · range {vs.min}–{vs.max}</span></> : '–'}</TableCell>
                  <TableCell>{story.outcome && OUTCOME[story.outcome] ? <Badge variant="outline" className={OUTCOME[story.outcome].cls}>{OUTCOME[story.outcome].text}</Badge>
                    : story.skipped ? <><Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Skipped</Badge>{story.note && <div className="mt-1 max-w-48 text-xs text-amber-800">{story.note}</div>}</> : '–'}{story.rounds > 1 && <div className="mt-1 text-xs text-muted-foreground">{story.rounds - 1} {story.rounds === 2 ? 'revote' : 'revotes'}</div>}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1.5">{open.st.finalVotes(story).map((v) => {
                    const m = nameOf(v.memberId)
                    return <Badge key={v.id} variant="secondary" className="gap-1.5 font-normal">{m && <Avatar character={m.character} name={m.name} size={16} />}{m?.name ?? '?'} <span className="font-mono font-semibold">{label(v.value)}</span></Badge>
                  })}</div></TableCell>
                </TableRow>
              ) })}</TableBody>
            </Table>
          </div>
        </DialogContent>}
      </Dialog>
    </div>
  )
}
