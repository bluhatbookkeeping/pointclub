import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowLeftToLine, ArrowRight, ArrowUpToLine, Check, Circle, ExternalLink, Pencil, SkipForward, Trash2 } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SortableList } from '@/components/SortableList'
import { NO_AUTOFILL, StoryImport } from '@/components/StoryImport'
import { label } from '@/components/TicketCard'
import { buildAdoUrl, stripLinks, toAdoPattern } from '@/lib/parseStories'
import { cn, sessionName } from '@/lib/utils'
import type { Story } from '@/lib/types'
import type { RoomApi } from '@/lib/useRoom'

/** Shows plain text; click to edit. Saves when you leave the box or press Enter (Escape cancels). */
function Cell({ value, onSave, className, textClass, placeholder, ariaLabel, numeric, display }: {
  value: string; onSave: (v: string) => void; className?: string; textClass?: string; placeholder?: string; ariaLabel: string; numeric?: boolean; display?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)
  useEffect(() => { if (!editing) setV(value) }, [value, editing])
  const commit = () => { setEditing(false); const t = v.trim(); if (t !== value && !(numeric && !t)) onSave(t); else setV(value) }
  if (!editing) return (
    <button type="button" aria-label={ariaLabel} title="Click to edit" onClick={() => setEditing(true)}
      className={cn('min-h-8 w-full rounded-md px-2 py-1 text-left hover:bg-background hover:ring-1 hover:ring-input', textClass)}>
      {display ?? (value || <span className="text-muted-foreground">{placeholder}</span>)}
    </button>
  )
  return (
    <Input {...NO_AUTOFILL} autoFocus value={v} placeholder={placeholder} aria-label={ariaLabel}
      className={cn('h-8 px-2', className)} inputMode={numeric ? 'numeric' : undefined}
      onChange={(e) => setV(numeric ? e.target.value.replace(/\D/g, '') : e.target.value)}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setV(value); setEditing(false) } }} />
  )
}

/** "ADO ↗" when the story has a link (with a small edit button), "Add link" when it doesn't. */
function LinkCell({ story, onSave }: { story: Story; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  if (editing || !story.url) {
    if (!editing) return <button type="button" className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline" aria-label={`ADO link for #${story.number}`} onClick={() => setEditing(true)}>Add link</button>
    return <LinkInput story={story} onDone={(v) => { setEditing(false); if (v !== (story.url ?? '')) onSave(v) }} />
  }
  return (
    <span className="flex items-center gap-1 px-2 py-1.5 text-xs">
      <a href={story.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline" title={story.url}>ADO <ExternalLink className="h-3 w-3" /></a>
      <button type="button" className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100" aria-label={`ADO link for #${story.number}`} title="Change link" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></button>
    </span>
  )
}
function LinkInput({ story, onDone }: { story: Story; onDone: (v: string) => void }) {
  const [v, setV] = useState(story.url ?? '')
  return <Input {...NO_AUTOFILL} autoFocus value={v} placeholder="Paste ADO link" className="h-8 px-2 font-mono text-xs" aria-label={`ADO link for #${story.number}`}
    onChange={(e) => setV(e.target.value)} onBlur={() => onDone(v.trim())} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') onDone(story.url ?? '') }} />
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
  // Titles read before the link fix may end in broken link text ("… On hold https: /"). Clean them once.
  const cleaned = useRef(false)
  useEffect(() => {
    if (!isHost || cleaned.current) return
    cleaned.current = true
    for (const s of [...backlog, ...lineup]) { const t = stripLinks(s.title); if (t && t !== s.title) actions.editStory({ ...s, title: t }) }
  }, [isHost]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const deletePicked = async () => {
    const list = backlog.filter((s) => picked.includes(s.id))
    if (!list.length) return
    const preview = list.slice(0, 5).map((s) => `#${s.number} ${s.title}`).join('\n') + (list.length > 5 ? `\n…and ${list.length - 5} more` : '')
    if (!confirm(`Delete ${list.length} ${list.length === 1 ? 'story' : 'stories'} from Point Club? (Not from ADO.)\n\n${preview}`)) return
    setPicked([])
    for (const s of list) await actions.removeStory(s.id)
  }
  const sessionLabel = activeSprint ? sessionName(activeSprint.name) : 'Session'
  const pointedCount = lineup.filter((s) => s.points).length

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
          <p className="text-muted-foreground">Keep every story in the <b className="text-foreground">Backlog</b>, ranked top to bottom. Move the ones you'll point at the next meeting into <b className="text-foreground">Next session</b>.</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* BACKLOG */}
          <section className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm" data-testid="backlog-col">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Backlog <span className="text-muted-foreground">({backlog.length})</span></h2>
            </div>

            {isHost && <div className="rounded-lg bg-secondary/40 p-3"><StoryImport onAdd={add} /></div>}
            {linkNote && <p className="text-sm text-emerald-700">{linkNote}</p>}

            {backlog.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">The backlog is empty. {isHost ? 'Add stories above.' : ''}</p>
            ) : (
              <div className="grid gap-0.5">
                {isHost && (
                  <div className={cn('sticky top-14 z-10 -mx-1.5 mb-1 flex min-h-11 flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    picked.length ? 'border-primary/40 bg-primary/[0.06]' : 'bg-card')} data-testid="bulk-bar">
                    <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" aria-label="Select all"
                      checked={picked.length > 0 && picked.length === backlog.length}
                      ref={(el) => { if (el) el.indeterminate = picked.length > 0 && picked.length < backlog.length }}
                      onChange={(e) => setPicked(e.target.checked ? backlog.map((s) => s.id) : [])} />
                    {picked.length === 0 ? (
                      <span className="text-muted-foreground">Tick stories to move them to the next session or delete them, several at once.</span>
                    ) : <>
                      <span className="font-medium">{picked.length} selected</span>
                      <Button size="sm" onClick={() => moveIn(backlog.filter((s) => picked.includes(s.id)).map((s) => s.id))}>
                        Move to next session <ArrowRight />
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={deletePicked}>
                        <Trash2 /> Delete {picked.length}
                      </Button>
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setPicked([])}>Clear</Button>
                    </>}
                  </div>
                )}
                <div className="grid grid-cols-[1rem_1.5rem_1rem_5.5rem_minmax(0,1fr)_5.5rem_4.75rem] items-center gap-2 px-1.5 pb-1 text-xs font-medium text-muted-foreground">
                  <span /><span className="text-right">#</span><span /><span className="px-2">Story</span><span className="px-2">Title</span><span className="px-2">ADO</span><span />
                </div>
                <SortableList items={backlog} enabled={isHost} onReorder={actions.reorder}
                  renderItem={(s, i, handle) => (
                    <div data-testid="plan-backlog-row" className={cn('group grid grid-cols-[1rem_1.5rem_1rem_5.5rem_minmax(0,1fr)_5.5rem_4.75rem] items-start gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-secondary/50',
                      fresh.includes(s.id) && 'bg-emerald-50 ring-1 ring-emerald-200', picked.includes(s.id) && 'bg-primary/[0.07]')}>
                      {isHost ? handle : <span />}
                      <span className="pt-2 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                      {isHost ? <input type="checkbox" className="mt-2 h-4 w-4 accent-[hsl(var(--primary))]" checked={picked.includes(s.id)} aria-label={`Pick #${s.number}`}
                        onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} /> : <span />}
                      {isHost ? <>
                        <Cell value={s.number} numeric className="font-mono" textClass="font-mono text-sm" ariaLabel={`Story number for #${s.number}`} onSave={(v) => save(s, { number: v })} />
                        <div className="min-w-0">
                          <Cell value={s.title} textClass="text-sm leading-snug line-clamp-2 break-words" ariaLabel={`Title for #${s.number}`} onSave={(v) => v && save(s, { title: v })} />
                          {s.note && <div className="truncate px-2 text-xs text-amber-800" title={s.note}>{s.note}</div>}
                        </div>
                        <LinkCell story={s} onSave={(v) => save(s, { url: v })} />
                      </> : <>
                        <span className="px-2 font-mono text-sm">#{s.number}</span>
                        <span className="min-w-0 px-2 py-1 text-sm leading-snug">{s.title}</span>
                        <span className="px-2 py-1 text-xs">{s.url && <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">ADO <ExternalLink className="h-3 w-3" /></a>}</span>
                      </>}
                      {isHost ? (
                        <span className="flex items-center justify-end gap-1 pt-1">
                          <button className={cn('rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground', i === 0 && 'invisible')} title="Move to top" aria-label={`Move #${s.number} to top`}
                            onClick={() => actions.reorder([s.id, ...backlog.filter((x) => x.id !== s.id).map((x) => x.id)])}><ArrowUpToLine className="h-3.5 w-3.5" /></button>
                          <button className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete from Point Club" aria-label={`Delete #${s.number}`}
                            onClick={() => { if (confirm(`Delete #${s.number} "${s.title}"?\nIt will be removed from Point Club (not from ADO).`)) actions.removeStory(s.id) }}><Trash2 className="h-3.5 w-3.5" /></button>
                          <button className="rounded p-1 text-primary hover:bg-primary/10" title="Move to next session" aria-label={`Move #${s.number} to next session`}
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
              <h2 className="text-lg font-semibold">Next session <span className="font-normal text-muted-foreground">· {sessionLabel}</span></h2>
              <p className="text-xs text-muted-foreground" data-testid="session-count">{lineup.length === 0 ? 'No stories yet' : `${lineup.length} ${lineup.length === 1 ? 'story' : 'stories'}, in voting order`}{pointedCount ? ` · ${pointedCount} pointed` : ''}</p>
            </div>
            {lineup.length === 0 ? (
              <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">Pick the stories for the next meeting.<br />Tick them in the backlog and click <b>Move to next session</b>,<br />or use <ArrowRight className="inline h-3.5 w-3.5" /> on a row.</p>
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
