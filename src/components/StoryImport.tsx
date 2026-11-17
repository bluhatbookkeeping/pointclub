import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ImageUp, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { readImage } from '@/lib/ocr'
import { parseStories, type ParsedStory } from '@/lib/parseStories'

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
  const [one, setOne] = useState({ number: '', title: '', url: '' })
  const numRef = useRef<HTMLInputElement>(null)
  const addRef = useRef(onAdd); addRef.current = onAdd

  const report = (what: string, r: { added: number; skipped: number }) =>
    setNote(`${what}: added ${r.added} ${r.added === 1 ? 'story' : 'stories'} to the backlog.${r.skipped ? ` ${r.skipped} ${r.skipped === 1 ? 'was' : 'were'} already there.` : ''}`)

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
    report(`${imgs.length} ${imgs.length === 1 ? 'screenshot' : 'screenshots'} read`, { added, skipped })
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
    const found = parseStories(raw)
    if (!found.length) { setError('No stories found. Put one per line, starting with the story number.'); return }
    setError(null); report('List added', await onAdd(found)); setRaw('')
  }
  const addOne = async () => {
    if (!one.number.trim() || !one.title.trim()) { setError('Type a story number and a title.'); return }
    setError(null)
    const r = await onAdd([{ number: one.number.trim(), title: one.title.trim(), url: one.url.trim() || undefined }])
    setNote(r.added ? `Added #${one.number.trim()} to the backlog.` : `#${one.number.trim()} is already planned.`)
    setOne({ number: '', title: '', url: '' }); numRef.current?.focus()
  }

  return (
    <div className="grid gap-3">
      {/* One story by hand */}
      <form className="grid grid-cols-[6.5rem_1fr_minmax(0,14rem)_auto] gap-2" onSubmit={(e) => { e.preventDefault(); addOne() }}>
        <Input {...NO_AUTOFILL} ref={numRef} className="h-9 font-mono" placeholder="Story #" inputMode="numeric" value={one.number} aria-label="New story number"
          onChange={(e) => setOne({ ...one, number: e.target.value.replace(/\D/g, '') })} />
        <Input {...NO_AUTOFILL} className="h-9" placeholder="Title" value={one.title} aria-label="New story title" onChange={(e) => setOne({ ...one, title: e.target.value })} />
        <Input {...NO_AUTOFILL} className="h-9 font-mono text-xs" placeholder="ADO link (optional)" value={one.url} aria-label="New story ADO link" onChange={(e) => setOne({ ...one, url: e.target.value })} />
        <Button type="submit" size="sm" className="h-9"><Plus /> Add</Button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground transition-colors hover:bg-secondary/50"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); readImages([...e.dataTransfer.files]) }}>
          <input type="file" accept="image/*" multiple className="hidden" aria-label="Choose screenshots" onChange={(e) => { readImages([...(e.target.files ?? [])]); e.target.value = '' }} />
          <ImageUp className="h-6 w-6" />
          <span>Drop ADO screenshots here, click to choose, or press <kbd className="rounded border bg-muted px-1 font-mono text-xs">Ctrl V</kbd></span>
          <span className="text-xs">Read on this computer, never uploaded.</span>
          {busy != null && <span className="flex items-center gap-2 text-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading… {Math.round(busy * 100)}%</span>}
        </label>
        <div className="grid gap-2">
          <Textarea className="h-[4.5rem] font-mono text-xs" placeholder={'Or paste a list, one story per line:\n48213 Export invoices to CSV'} value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Paste stories" />
          <Button variant="secondary" size="sm" disabled={!raw.trim()} onClick={addList}>Add list to backlog</Button>
        </div>
      </div>

      {shots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shots.map((s) => (
            <div key={s.thumb} className="relative">
              <img src={s.thumb} alt="" className="h-12 w-20 rounded border object-cover object-left-top" />
              <span className="absolute bottom-0.5 right-0.5 rounded bg-background/90 px-1 text-[10px] font-medium">{s.found == null ? '…' : `${s.found} found`}</span>
            </div>
          ))}
        </div>
      )}
      {note && <p className="text-sm text-emerald-700" data-testid="import-note">{note}</p>}
      {error && <p className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p>}
    </div>
  )
}
