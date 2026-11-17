import { ArrowRight, Check, Circle, ExternalLink, SkipForward } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { label } from '@/components/TicketCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { sessionName } from '@/lib/utils'
import type { RoomApi } from '@/lib/useRoom'

/** Read-only story list for the upcoming session: share it before the meeting instead of an email. */
export function Agenda({ api }: { api: RoomApi }) {
  const { activeSprint, lineup } = api
  const joinUrl = () => { const u = new URL(location.href); u.searchParams.delete('agenda'); return u.toString() }
  const pointed = lineup.filter((s) => s.points)
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-6">
          <Logo />
          <Button className="ml-auto" onClick={() => { location.href = joinUrl() }}>Join the table <ArrowRight /></Button>
        </div>
      </header>
      <div className="mx-auto max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardDescription>Story pointing agenda</CardDescription>
            <CardTitle className="text-2xl">{sessionName(activeSprint?.name)}</CardTitle>
            <CardDescription>
              {lineup.length} {lineup.length === 1 ? 'story' : 'stories'} to point
              {pointed.length > 0 && ` · ${pointed.length} done so far`}. Read through them before the meeting. Links open in ADO (needs VPN).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            {lineup.length === 0 && <p className="py-6 text-center text-muted-foreground">No stories added yet. Check back closer to the meeting.</p>}
            {lineup.map((s, i) => (
              <div key={s.id} className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-secondary/50">
                <span className="w-6 pt-0.5 text-right text-sm tabular-nums text-muted-foreground">{i + 1}.</span>
                {s.points ? <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" /> : s.skipped ? <SkipForward className="mt-1 h-4 w-4 shrink-0 text-amber-600" /> : <Circle className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40" />}
                <div className="min-w-0 flex-1">
                  <div className="break-words"><span className="font-mono text-sm text-muted-foreground">#{s.number}</span> <span className="font-medium">{s.title}</span></div>
                  {s.note && <div className="text-sm text-amber-800">Note: {s.note}</div>}
                </div>
                {s.points && <Badge variant="secondary" className="font-mono">{label(s.points)} pts</Badge>}
                {s.skipped && !s.points && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Skipped</Badge>}
                {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">ADO <ExternalLink className="h-3.5 w-3.5" /></a>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
