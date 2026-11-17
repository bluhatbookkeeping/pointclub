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
  blockbuster: { text: 'Clean job', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  critics: { text: 'Close enough', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  plottwist: { text: 'Compromised', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export function Vault({ api, onBack }: { api: RoomApi; onBack: () => void }) {
  const sprints = [...api.sprints].sort((a, b) => b.startedAt - a.startedAt)
  const [openId, setOpenId] = useState<string | null>(null)
  const stats = sprints.map((s) => ({ s, st: sprintStats(s, api.stories, api.votes, api.members) }))
  const maxPts = Math.max(1, ...stats.map((x) => x.st.total))
  const open = stats.find((x) => x.s.id === openId)
  const nameOf = (id: string) => api.members.find((m) => m.id === id)

  const exportCsv = () => {
    const rows = [['Sprint', 'Codename', 'Story #', 'Title', 'Points', 'Outcome', 'Attempts', 'Votes']]
    for (const { s, st } of stats) for (const story of st.list)
      rows.push([s.name, s.title, story.number, story.title, story.points ?? '', story.outcome ?? '', String(story.rounds),
        st.finalVotes(story).map((v) => `${nameOf(v.memberId)?.name ?? '?'}=${label(v.value)}`).join('; ')])
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
        <div><h1 className="text-3xl font-semibold tracking-tight">Case Files</h1><p className="text-muted-foreground">Every sprint the crew has pointed.</p></div>

        <Card>
          <CardHeader><CardTitle className="text-base">Velocity</CardTitle><CardDescription>Points locked in per sprint</CardDescription></CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-36">
              {[...stats].reverse().map(({ s, st }) => (
                <div key={s.id} className="flex flex-col items-center gap-1 flex-1 max-w-20">
                  <div className="text-xs tabular-nums">{st.total}</div>
                  <motion.div initial={{ height: 0 }} animate={{ height: Math.max(2, (st.total / maxPts) * 100) }} className="w-full rounded-sm bg-felt" />
                  <div className="text-[11px] text-muted-foreground truncate w-full text-center">{s.name}</div>
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
                  <Badge variant={s.closedAt ? 'secondary' : 'default'}>{s.closedAt ? 'Case closed' : 'Active'}</Badge>
                  {s.closedAt ? <FolderClosed className="h-4 w-4 text-muted-foreground" /> : <FolderOpen className="h-4 w-4 text-muted-foreground" />}
                </div>
                <CardTitle className="pt-2">{s.name}</CardTitle>
                <CardDescription>{s.title || 'No codename'} · {new Date(s.startedAt).toLocaleDateString()}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums">{st.total} <span className="text-sm font-normal text-muted-foreground">pts</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="outline">{st.pointed.length} pointed</Badge>
                  <Badge variant="outline" className={OUTCOME.blockbuster.cls}>{st.blockbusters} clean</Badge>
                  <Badge variant="outline" className={OUTCOME.plottwist.cls}>{st.twists} compromised</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        {open && <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{open.s.name}{open.s.title ? ` · ${open.s.title}` : ''}</DialogTitle>
            <DialogDescription>
              {open.st.total} points · {open.st.blockbusters} clean · {open.st.twists} compromised
              {open.st.sharpshooter ? ` · Sharpshooter: ${open.st.sharpshooter.name}` : ''}{open.st.contrarian ? ` · Wild card: ${open.st.contrarian.name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Story</TableHead><TableHead className="w-20">Points</TableHead><TableHead className="w-44">Outcome</TableHead><TableHead>Final votes</TableHead></TableRow></TableHeader>
              <TableBody>{open.st.list.map((story) => (
                <TableRow key={story.id} className="align-top">
                  <TableCell><span className="font-mono text-xs text-muted-foreground">#{story.number}</span><br />{story.url ? <a className="underline-offset-4 hover:underline" href={story.url} target="_blank" rel="noreferrer">{story.title}</a> : story.title}</TableCell>
                  <TableCell className="font-mono text-lg">{story.points ? label(story.points) : '–'}</TableCell>
                  <TableCell>{story.outcome && OUTCOME[story.outcome] ? <Badge variant="outline" className={OUTCOME[story.outcome].cls}>{OUTCOME[story.outcome].text}</Badge> : '–'}{story.rounds > 1 && <span className="ml-2 text-xs text-muted-foreground">{story.rounds} attempts</span>}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1.5">{open.st.finalVotes(story).map((v) => {
                    const m = nameOf(v.memberId)
                    return <Badge key={v.id} variant="secondary" className="gap-1.5 font-normal">{m && <Avatar character={m.character} name={m.name} size={16} />}{m?.name ?? '?'} <span className="font-mono font-semibold">{label(v.value)}</span></Badge>
                  })}</div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        </DialogContent>}
      </Dialog>
    </div>
  )
}
