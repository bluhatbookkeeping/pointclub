import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ClipboardList, ImageUp, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { readImage } from '@/lib/ocr'
import { parseHtmlLinks, parseStories, type ParsedStory } from '@/lib/parseStories'

// Password managers mistake these boxes for login fields and add their own icons; tell them to stay out.
export const NO_AUTOFILL = { autoComplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-bwignore': 'true', 'data-form-type': 'other' } as const

type Add = (rows: ParsedStory[]) => Promise<{ added: number; skipped: number }>

/**
 * Everything that puts stories into the backlog: ADO screenshots (drop, choose or Ctrl+V), a pasted list,
 * or one story typed by hand. Stories are saved the moment they're read; there is no separate Save step.
 */
export function StoryImport({ onAdd }: { onAdd: Add }) {
  const [busy, setBusy] = useState<number | null>(null)
  const [shots, setShots] = useState<{ thumb: string; found: number | null }[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState('')
  const [one, setOne] = useState({ number: '', title: '' })
  const [mode, setMode] = useState<'none' | 'one' | 'list'>('none')
  const [viewing, setViewing] = useState<number | null>(null)
  const numRef = useRef<HTMLInputElement>(null)
  const addRef = useRef(onAdd); addRef.current = onAdd

  const report = (what: string, r: { added: number; skipped: number }) =>
    setNote(`${what}: added ${r.added} ${r.added === 1 ? 'story' : 'stories'} to the backlog.${r.skipped ? ` ${r.skipped} ${r.skipped === 1 ? 'was' : 'were'} already in it.` : ''}`)

  const readImages = async (files: Blob[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) return
    setError(null)
    let added = 0, skipped = 0
    for (const file of imgs) {
      const thumb = URL.createObjectURL(file)
      setShots((s) => [...s, { thumb, found: null }]); setBusy(0)
      try {
        const found = parseStories(await readImage(file, setBusy))
        const r = await addRef.current(found)
        added += r.added; skipped += r.skipped
        setShots((s) => s.map((x) => (x.thumb === thumb ? { ...x, found: found.length } : x)))
      } catch (e: any) {
        setShots((s) => s.filter((x) => x.thumb !== thumb))
        setError('Could not read a screenshot: ' + (e?.message ?? e))
      }
    }
    setBusy(null)
    report(`Read ${imgs.length} ${imgs.length === 1 ? 'screenshot' : 'screenshots'}`, { added, skipped })
  }

  // Ctrl+V anywhere on the page with an image on the clipboard reads it.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const img = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile()
      if (img) { e.preventDefault(); readImages([img]) }
    }
    window.addEventListener('paste', onPaste); return () => window.removeEventListener('paste', onPaste)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addList = async () => {
    const found = parseStories(raw, { allowMissingNumber: true })
    if (!found.length) { setError('No stories found. Put one story per line.'); return }
    setError(null); report('List added', await onAdd(found)); setRaw('')
  }
  const addOne = async () => {
    if (!one.number.trim() || !one.title.trim()) { setError('Type a story number and a title.'); return }
    setError(null)
    const r = await onAdd([{ number: one.number.trim(), title: one.title.trim() }])
    setNote(r.added ? `Added #${one.number.trim()} to the backlog.` : `#${one.number.trim()} is already in the backlog or the next session.`)
    setOne({ number: '', title: '' }); numRef.current?.focus()
  }

  return (
    <div className="grid gap-3">
      <div className="text-sm font-semibold">Add stories to the backlog</div>
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-background p-4 text-center text-sm text-muted-foreground transition-colors hover:bg-secondary/50"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); readImages([...e.dataTransfer.files]) }}>
        <input type="file" accept="image/*" multiple className="hidden" aria-label="Choose screenshots" onChange={(e) => { readImages([...(e.target.files ?? [])]); e.target.value = '' }} />
        <ImageUp className="h-6 w-6" />
        <span><b className="font-medium text-foreground">Drop ADO backlog screenshots here</b>, or click to choose. <kbd className="rounded border bg-muted px-1 font-mono text-xs">Ctrl+V</kbd> works too.</span>
        <span className="text-xs">Point Club reads the story numbers and titles. Screenshots stay on this computer.</span>
        {busy != null && <span className="flex items-center gap-2 text-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading… {Math.round(busy * 100)}%</span>}
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={mode === 'one' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode(mode === 'one' ? 'none' : 'one')}><Plus /> Add one story</Button>
        <Button variant={mode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setMode(mode === 'list' ? 'none' : 'list')}><ClipboardList /> Paste a list</Button>
      </div>

      {mode === 'one' && (
        <form className="grid grid-cols-[7rem_1fr_auto] gap-2" onSubmit={(e) => { e.preventDefault(); addOne() }}>
          <Input {...NO_AUTOFILL} ref={numRef} autoFocus className="h-9 font-mono" placeholder="Story #" inputMode="numeric" value={one.number} aria-label="New story number"
            onChange={(e) => setOne({ ...one, number: e.target.value.replace(/\D/g, '') })} />
          <Input {...NO_AUTOFILL} className="h-9" placeholder="Story title" value={one.title} aria-label="New story title" onChange={(e) => setOne({ ...one, title: e.target.value })} />
          <Button type="submit" size="sm" className="h-9">Add to backlog</Button>
        </form>
      )}
      {mode === 'list' && (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">One story per line. The story number is optional (you can add it after). Copying from ADO, an email or a doc where the titles are links? Paste here and the links come along, with the story numbers read from them.</p>
          <Textarea autoFocus onPaste={async (e) => {
            // Titles that are links (from ADO, email, Word, Excel): keep the link and read the story number from it.
            const html = e.clipboardData.getData('text/html')
            const linked = html ? parseHtmlLinks(html) : []
            if (linked.length) { e.preventDefault(); setError(null); report(`Pasted ${linked.length} linked ${linked.length === 1 ? 'story' : 'stories'}`, await onAdd(linked)) }
          }} className="h-24 font-mono text-xs" placeholder={'123456 Story title\nStory title without a number'} value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Paste stories" />
          <Button size="sm" className="justify-self-start" disabled={!raw.trim()} onClick={addList}>Add list to backlog</Button>
        </div>
      )}

      {shots.length > 0 && (
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Screenshots read so far (click one to see it full size):</span>
          <div className="flex flex-wrap gap-2">
            {shots.map((s, i) => (
              <button key={s.thumb} type="button" onClick={() => setViewing(i)} title="View full screenshot" aria-label={`View screenshot ${i + 1}`}
                className="group relative overflow-hidden rounded-md border bg-background shadow-sm transition hover:ring-2 hover:ring-primary">
                <img src={s.thumb} alt={`Screenshot ${i + 1}`} className="h-24 w-40 object-cover object-left-top" />
                <span className="absolute inset-x-0 bottom-0 bg-background/90 px-1.5 py-0.5 text-left text-[11px] font-medium">{s.found == null ? 'Reading…' : `${s.found} stories found`}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <Dialog open={viewing != null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-[min(95vw,1400px)]">
          <DialogHeader>
            <DialogTitle>Screenshot {viewing != null ? viewing + 1 : ''} of {shots.length}</DialogTitle>
            <DialogDescription>{viewing != null && shots[viewing]?.found != null ? `${shots[viewing].found} stories found in this screenshot.` : ''}</DialogDescription>
          </DialogHeader>
          {viewing != null && shots[viewing] && <img src={shots[viewing].thumb} alt={`Screenshot ${viewing + 1}`} className="max-h-[75vh] w-full rounded border object-contain" />}
          {shots.length > 1 && (
            <div className="flex justify-between">
              <Button variant="outline" size="sm" disabled={!viewing} onClick={() => setViewing((v) => (v ? v - 1 : v))}>Previous</Button>
              <Button variant="outline" size="sm" disabled={viewing == null || viewing >= shots.length - 1} onClick={() => setViewing((v) => (v != null ? v + 1 : v))}>Next</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {note && <p className="text-sm text-emerald-700" data-testid="import-note">{note}</p>}
      {error && <p className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p>}
    </div>
  )
}
