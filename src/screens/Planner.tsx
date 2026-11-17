import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowLeftToLine, ArrowRight, ArrowUpToLine, Check, Circle, ExternalLink, SkipForward, Trash2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SortableList } from '@/components/SortableList'
import { NO_AUTOFILL, StoryImport } from '@/components/StoryImport'
import { label } from '@/components/TicketCard'
import { buildAdoUrl, toAdoPattern } from '@/lib/parseStories'
import { cn, sessionName } from '@/lib/utils'
import type { Story } from '@/lib/types'
import type { RoomApi } from '@/lib/useRoom'

/** A text box that saves when you leave it or press Enter (nothing is lost by clicking elsewhere). */
function Cell({ value, onSave, className, placeholder, ariaLabel, numeric }: {
  value: string; onSave: (v: string) => void; className?: string; placeholder?: string; ariaLabel: string; numeric?: boolean
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const commit = () => { const t = v.trim(); if (t !== value) { if (numeric && !t) { setV(value); return } onSave(t) } }
  return (
    <Input {...NO_AUTOFILL} value={v} placeholder={placeholder} aria-label={ariaLabel} title={v}
      className={cn('h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus:border-input focus:bg-background', className)}
      inputMode={numeric ? 'numeric' : undefined}
      onChange={(e) => setV(numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(value); (e.target as HTMLInputElement).blur() } }} />
  )
}

/**
 * Plan stories: the backlog on the left (ranked, editable), this session's stories on the right.
 * Every change saves immediately. Stories only leave the backlog by moving to the session or by Delete.
 */
export function Planner({ api, onBack }: { api: RoomApi; onBack: () => void }) {
  const { backlog, lineup, isHost, actions, room, activeSprint } = api
  const [picked, setPicked] = useState<string[]>([])
  const [fresh, setFresh] = useState<string[]>([])
  const [linkNote, setLinkNote] = useState<string | null>(null)
  useEffect(() => setPicked((p) => p.filter((id) => backlog.some((s) => s.id === id))), [backlog])

  const add = async (rows: Parameters<typeof actions.addStories>[0]) => {
    const r = await actions.addStories(rows, room?.adoPattern ?? '', 'backlog')
    const ids = r.added.map((s) => s.id)
    setFresh((f) => [...f, ...ids]); setTimeout(() => setFresh((f) => f.filter((x) => !ids.includes(x))), 6000)
    return { added: r.added.length, skipped: r.skipped }
  }

  /** Save one field. A pasted ADO link teaches Point Club the link pattern and fills every story missing one. */
  const save = async (s: Story, p: Partial<Story>) => {
    await actions.editStory({ ...s, ...p })
    const url = p.url?.trim()
    if (url && url.includes(s.number)) {
      const pattern = toAdoPattern(url)
      if (pattern.includes('{id}') && buildAdoUrl(pattern, s.number) === url && pattern !== room?.adoPattern) {
        const missing = [...backlog, ...lineup].filter((x) => x.id !== s.id && !x.url).length
        await actions.setAdoPattern(pattern)
        setLinkNote(missing ? `Got it. Filled in ADO links for ${missing} more ${missing === 1 ? 'story' : 'stories'}.` : 'Got it. New stories will get their ADO link automatically.')
        setTimeout(() => setLinkNote(null), 6000)
      }
    }
  }

  const moveIn = async (ids: string[]) => { await actions.moveToSession(ids); setPicked([]) }
  const sessionLabel = activeSprint ? sessionName(activeSprint.name) : 'This session'

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-6">
          <Logo />
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft /> Back to the table</Button>
          <span className="ml-auto text-xs text-muted-foreground">Changes save as you go.</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 p-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Plan stories</h1>
          <p className="text-muted-foreground">Keep every story in the <b className="text-foreground">Backlog</b>, ranked top to bottom. Move the ones you'll point next into <b className="text-foreground">This session</b>.</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* BACKLOG */}
          <section className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm" data-testid="backlog-col">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Backlog <span className="text-muted-foreground">({backlog.length})</span></h2>
              {isHost && picked.length > 0 && (
                <Button size="sm" className="ml-auto" onClick={() => moveIn(backlog.filter((s) => picked.includes(s.id)).map((s) => s.id))}>
                  Move {picked.length} to this session <ArrowRight />
                </Button>
              )}
            </div>

            {isHost && <div className="rounded-lg bg-secondary/40 p-3"><StoryImport onAdd={add} /></div>}
            {linkNote && <p className="text-sm text-emerald-700">{linkNote}</p>}

            {backlog.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">The backlog is empty. {isHost ? 'Add stories above.' : ''}</p>
            ) : (
              <div className="grid gap-0.5">
                <div className="grid grid-cols-[1rem_1.5rem_1rem_5.5rem_minmax(0,1fr)_minmax(0,8.5rem)_4.75rem] items-center gap-2 px-1.5 pb-1 text-xs font-medium text-muted-foreground">
                  <span /><span className="text-right">#</span><span /><span className="px-2">Story</span><span className="px-2">Title</span><span className="px-2">ADO link</span><span />
                </div>
                <SortableList items={backlog} enabled={isHost} onReorder={actions.reorder}
                  renderItem={(s, i, handle) => (
                    <div data-testid="plan-backlog-row" className={cn('group grid grid-cols-[1rem_1.5rem_1rem_5.5rem_minmax(0,1fr)_minmax(0,8.5rem)_4.75rem] items-center gap-2 rounded-md px-1.5 py-0.5 transition-colors hover:bg-secondary/50',
                      fresh.includes(s.id) && 'bg-emerald-50 ring-1 ring-emerald-200', picked.includes(s.id) && 'bg-primary/[0.07]')}>
                      {isHost ? handle : <span />}
                      <span className="text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                      {isHost ? <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={picked.includes(s.id)} aria-label={`Pick #${s.number}`}
                        onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} /> : <span />}
                      {isHost ? <>
                        <Cell value={s.number} numeric className="font-mono" ariaLabel={`Story number for #${s.number}`} onSave={(v) => save(s, { number: v })} />
                        <div className="min-w-0">
                          <Cell value={s.title} ariaLabel={`Title for #${s.number}`} onSave={(v) => v && save(s, { title: v })} />
                          {s.note && <div className="truncate px-2 text-xs text-amber-800" title={s.note}>{s.note}</div>}
                        </div>
                        <Cell value={s.url ?? ''} placeholder="Paste link" className="font-mono text-xs" ariaLabel={`ADO link for #${s.number}`} onSave={(v) => save(s, { url: v })} />
                      </> : <>
                        <span className="px-2 font-mono text-sm">#{s.number}</span>
                        <span className="min-w-0 px-2 text-sm">{s.title}</span>
                        <span className="truncate px-2 text-xs">{s.url && <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline"><ExternalLink className="h-3 w-3" /> Open in ADO</a>}</span>
                      </>}
                      {isHost ? (
                        <span className="flex items-center justify-end gap-1">
                          <button className={cn('rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground', i === 0 && 'invisible')} title="Move to top" aria-label={`Move #${s.number} to top`}
                            onClick={() => actions.reorder([s.id, ...backlog.filter((x) => x.id !== s.id).map((x) => x.id)])}><ArrowUpToLine className="h-3.5 w-3.5" /></button>
                          <button className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete from Point Club" aria-label={`Delete #${s.number}`}
                            onClick={() => { if (confirm(`Delete #${s.number} "${s.title}"?\nIt will be removed from Point Club (not from ADO).`)) actions.removeStory(s.id) }}><Trash2 className="h-3.5 w-3.5" /></button>
                          <button className="rounded p-1 text-primary hover:bg-primary/10" title="Move to this session" aria-label={`Move #${s.number} to this session`}
                            onClick={() => moveIn([s.id])}><ArrowRight className="h-4 w-4" /></button>
                        </span>
                      ) : <span />}
                    </div>
                  )} />
              </div>
            )}
          </section>

          {/* THIS SESSION */}
          <section className="grid gap-3 rounded-xl border-2 border-primary/30 bg-card p-4 shadow-sm lg:sticky lg:top-20" data-testid="session-col">
            <div>
              <h2 className="text-lg font-semibold">This session <span className="text-muted-foreground">({lineup.length})</span></h2>
              <p className="text-xs text-muted-foreground">{sessionLabel}. The stories the team points next, in voting order.</p>
            </div>
            {lineup.length === 0 ? (
              <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">Move stories here from the backlog<br />with <ArrowRight className="inline h-3.5 w-3.5" /> or the checkboxes.</p>
            ) : (
              <div className="grid gap-0.5">
                <SortableList items={lineup} enabled={isHost} canDrag={(s) => !s.points && !s.skipped} onReorder={actions.reorder}
                  renderItem={(s, i, handle) => (
                    <div data-testid="plan-session-row" className={cn('group flex items-start gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-secondary/50', (s.points || s.skipped) && 'opacity-60')}>
                      {isHost ? handle : null}
                      <span className="mt-0.5 w-4 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                      {s.points ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : s.skipped ? <SkipForward className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-xs text-muted-foreground">#{s.number}</span>
                        <span className="block break-words leading-snug">{s.title}</span>
                      </span>
                      {s.points && <Badge variant="secondary" className="font-mono">{label(s.points)} pts</Badge>}
                      {s.skipped && !s.points && <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Skipped</Badge>}
                      {isHost && !s.points && (
                        <button className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground" title="Back to the top of the backlog" aria-label={`Move #${s.number} back to backlog`}
                          onClick={() => actions.moveToBacklog(s.id)}><ArrowLeftToLine className="h-3.5 w-3.5" /> Backlog</button>
                      )}
                    </div>
                  )} />
              </div>
            )}
            {lineup.length > 0 && <Button variant="outline" onClick={onBack}>Go to the table to point them <ArrowRight /></Button>}
          </section>
        </div>
      </div>
    </div>
  )
}
