import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, ChevronDown, ImageUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { readImage } from '@/lib/ocr'
import { buildAdoUrl, ParsedStory, parseStories, toAdoPattern } from '@/lib/parseStories'
import { cn } from '@/lib/utils'
import type { RoomApi } from '@/lib/useRoom'

type Row = { number: string; title: string; url: string }
const blank = (): Row => ({ number: '', title: '', url: '' })
const BLANK_ROWS = 5
const hasContent = (r: Row) => !!(r.number.trim() || r.title.trim() || r.url.trim())

/** Learn the ADO link pattern from any row whose link contains its own story number. */
function learnPattern(rows: Row[], fallback: string) {
  for (const r of rows) {
    const url = r.url.trim()
    if (url && r.number && url.includes(r.number)) {
      const p = toAdoPattern(url)
      if (p.includes('{id}') && buildAdoUrl(p, r.number) === url) return p
    }
  }
  return fallback
}

// Password managers mistake these boxes for login fields and add their own icons; tell them to stay out.
const NO_AUTOFILL = { autoComplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-bwignore': 'true', 'data-form-type': 'other' } as const

export function LoadStories({ api, open, onClose, defaultTo = 'backlog' }: { api: RoomApi; open: boolean; onClose: () => void; defaultTo?: 'backlog' | 'session' }) {
  const { room, actions } = api
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: BLANK_ROWS }, blank))
  const [to, setTo] = useState<'backlog' | 'session'>(defaultTo)
  const [raw, setRaw] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [shots, setShots] = useState<{ thumb: string; found: number | null }[]>([])
  const setPreview = (_: null) => setShots([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  // Every time the dialog opens it starts clean: empty rows, no old links or text.
  useEffect(() => {
    if (!open) return
    setRows(Array.from({ length: BLANK_ROWS }, blank)); setRaw(''); setPreview(null); setBulkOpen(false)
    setError(null); setSavedNote(null); setTo(defaultTo)
  }, [open, defaultTo])

  const pattern = useMemo(() => learnPattern(rows, room?.adoPattern ?? ''), [rows, room?.adoPattern])
  const ready = rows.filter((r) => r.number.trim() && r.title.trim())
  const incomplete = rows.filter((r) => hasContent(r) && !(r.number.trim() && r.title.trim())).length

  const setRow = (i: number, p: Partial<Row>) => setRows((rs) => {
    const next = rs.map((x, j) => (j === i ? { ...x, ...p } : x))
    if (i === next.length - 1 && hasContent(next[i])) next.push(blank()) // typing in the last row opens another
    return next
  })
  /** Put parsed stories into the table, filling empty rows first. */
  const addParsed = (parsed: ParsedStory[]) => setRows((rs) => {
    const kept = rs.filter(hasContent)
    const merged = [...kept, ...parsed.filter((p) => !kept.some((k) => k.number === p.number)).map((p) => ({ number: p.number, title: p.title, url: p.url ?? '' }))]
    return [...merged, blank()]
  })

  /** Read one or more screenshots in turn; each adds its stories to the table (no duplicate IDs). */
  const handleImages = async (files: Blob[]) => {
    setError(null)
    for (const file of files.filter((f) => f.type.startsWith('image/'))) {
      const thumb = URL.createObjectURL(file)
      setShots((s) => [...s, { thumb, found: null }]); setProgress(0)
      try {
        const found = parseStories(await readImage(file, setProgress))
        addParsed(found)
        setShots((s) => s.map((x) => (x.thumb === thumb ? { ...x, found: found.length } : x)))
      } catch (e: any) {
        setShots((s) => s.filter((x) => x.thumb !== thumb))
        setError('Could not read a screenshot: ' + (e?.message ?? e))
      }
    }
    setProgress(null)
  }
  const handleImage = (file: Blob) => handleImages([file])
  useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      const img = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile()
      if (img) { e.preventDefault(); setBulkOpen(true); handleImage(img) }
    }
    window.addEventListener('paste', onPaste); return () => window.removeEventListener('paste', onPaste)
  }, [open])

  const save = async () => {
    setSaving(true); setError(null)
    try {
      if (pattern && pattern !== (room?.adoPattern ?? '')) await actions.setAdoPattern(pattern)
      await actions.addStories(ready.map((r) => ({ number: r.number.trim(), title: r.title.trim(), url: r.url.trim() || buildAdoUrl(pattern, r.number.trim()) })), pattern, to)
      setSavedNote(`Added ${ready.length} ${ready.length === 1 ? 'story' : 'stories'} to ${to === 'backlog' ? 'the backlog' : 'this session'}.`)
      setRows(Array.from({ length: BLANK_ROWS }, blank)); setRaw(''); setPreview(null)
      setTimeout(onClose, 800)
    } catch (e: any) {
      setError(`Couldn't save: ${e?.message ?? e}. Your stories are still here, so you can try again.`)
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Add stories</DialogTitle>
          <DialogDescription>Type each story's number and title. Paste one story's ADO link and the rest fill in automatically.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Where should these go?</span>
          <div className="inline-flex rounded-md border p-0.5">
            {(['backlog', 'session'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setTo(k)}
                className={cn('rounded px-3 py-1 text-sm transition-colors', to === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {k === 'backlog' ? 'Backlog' : 'This session'}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{to === 'backlog' ? 'Rank them in the Backlog tab. The top ones go into the next session.' : 'Vote on them in this session now.'}</span>
        </div>

        <div className="rounded-md border">
          {ready.length > 6 && <div className="border-b px-3 py-1.5 text-xs text-muted-foreground" data-testid="row-count">{ready.length} stories in the list. Scroll inside the table to see them all.</div>}
          <div className="grid grid-cols-[6.5rem_1fr_minmax(0,15rem)_2.25rem] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Story #</span><span>Title</span><span>ADO link</span><span />
          </div>
          <div className="max-h-[42vh] overflow-y-auto p-2 grid gap-1.5">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[6.5rem_1fr_minmax(0,15rem)_2.25rem] items-center gap-2">
                <Input {...NO_AUTOFILL} className="h-8 font-mono" placeholder="e.g. 48213" inputMode="numeric" value={r.number} onChange={(e) => setRow(i, { number: e.target.value.replace(/\D/g, '') })} aria-label={`Story number, row ${i + 1}`} />
                <Input {...NO_AUTOFILL} className="h-8" title={r.title} placeholder={i === 0 ? "Story title" : ""} value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} aria-label={`Title, row ${i + 1}`} />
                <Input {...NO_AUTOFILL} className="h-8 font-mono text-xs" placeholder={r.number && pattern ? buildAdoUrl(pattern, r.number) : 'Paste link (optional)'} value={r.url} onChange={(e) => setRow(i, { url: e.target.value })} aria-label={`ADO link, row ${i + 1}`} />
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Remove row" onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : [blank()]))}><Trash2 /></Button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, blank()])}><Plus /> Add row</Button>
          {pattern && <span className="text-xs text-muted-foreground">Rows without a link will use <span className="font-mono">{buildAdoUrl(pattern, '{#}')}</span></span>}
        </div>

        <div className="rounded-md border">
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium" onClick={() => setBulkOpen((v) => !v)}>
            <ChevronDown className={cn('h-4 w-4 transition-transform', !bulkOpen && '-rotate-90')} /> Bulk import: paste a list or a screenshot of the ADO backlog
          </button>
          {bulkOpen && (
            <div className="grid grid-cols-2 gap-4 border-t p-3">
              <div className="grid gap-2">
                <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground transition-colors hover:bg-secondary/50"
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleImages([...e.dataTransfer.files]) }}>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleImages([...(e.target.files ?? [])]); e.target.value = '' }} />
                  <ImageUp className="h-7 w-7" />
                  <span>Drop ADO screenshots here, click to choose (several at once is fine), or press <kbd className="rounded border bg-muted px-1 font-mono text-xs">Ctrl V</kbd><br /><span className="text-xs">Read on this computer, never uploaded.</span></span>
                  {progress != null && <span className="flex items-center gap-2 text-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading… {Math.round(progress * 100)}%</span>}
                </label>
                {shots.length > 0 && (
                  <div className="grid gap-1.5">
                    <div className="text-xs text-muted-foreground">
                      Read {shots.reduce((a, s) => a + (s.found ?? 0), 0)} {shots.reduce((a, s) => a + (s.found ?? 0), 0) === 1 ? 'story' : 'stories'} from {shots.length} {shots.length === 1 ? 'screenshot' : 'screenshots'}. Check the table above, then add ADO links if you like.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {shots.map((s) => (
                        <div key={s.thumb} className="relative">
                          <img src={s.thumb} className="h-14 w-24 rounded border object-cover object-left-top" />
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-background/90 px-1 text-[10px] font-medium">{s.found == null ? '…' : `${s.found} found`}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Textarea className="h-28 font-mono text-xs" placeholder={'One story per line:\n48213 Export invoices to CSV\n48214 Add vendor search'} value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Paste stories" />
                <Button variant="secondary" size="sm" disabled={!raw.trim()} onClick={() => { addParsed(parseStories(raw)); setRaw('') }}>Put these in the table</Button>
              </div>
            </div>
          )}
        </div>

        {error && <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {savedNote && <div className="flex items-center gap-2 text-sm text-emerald-700"><Check className="h-4 w-4" />{savedNote}</div>}

        <DialogFooter className="sticky -bottom-6 -mx-6 -mb-6 items-center gap-2 border-t bg-background px-6 py-4">
          {incomplete > 0 && <span className="mr-auto text-xs text-amber-700">{incomplete} {incomplete === 1 ? 'row needs' : 'rows need'} both a number and a title.</span>}
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || ready.length === 0}>
            {saving && <Loader2 className="animate-spin" />}
            {ready.length ? `Add ${ready.length} ${ready.length === 1 ? 'story' : 'stories'} to ${to === 'backlog' ? 'backlog' : 'this session'}` : 'Add stories'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
