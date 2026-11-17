import { useEffect, useState } from 'react'
import { AlertCircle, Check, ImageUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { readImage } from '@/lib/ocr'
import { buildAdoUrl, ParsedStory, parseStories, toAdoPattern } from '@/lib/parseStories'
import type { RoomApi } from '@/lib/useRoom'

/** A row's link: what the person typed for that story, otherwise the one built from the pattern. */
const linkFor = (r: ParsedStory, pattern: string) => (r.url?.trim() ? r.url.trim() : buildAdoUrl(pattern, r.number))

export function LoadStories({ api, open, onClose }: { api: RoomApi; open: boolean; onClose: () => void }) {
  const { room, lineup, actions } = api
  const [linkInput, setLinkInput] = useState(room?.adoPattern ?? '')
  const [rows, setRows] = useState<ParsedStory[]>([])
  const [raw, setRaw] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const pattern = toAdoPattern(linkInput)
  const converted = !!linkInput.trim() && !linkInput.includes('{id}') && pattern.includes('{id}')
  const patternInvalid = !!linkInput.trim() && !pattern.includes('{id}')

  useEffect(() => { if (open) { setLinkInput(room?.adoPattern ?? ''); setError(null); setSavedNote(null) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleImage = async (file: Blob) => {
    setPreview(URL.createObjectURL(file)); setProgress(0); setError(null)
    try { const text = await readImage(file, setProgress); setRaw(text); setRows(parseStories(text)) }
    catch (e: any) { setError('Could not read the screenshot: ' + (e?.message ?? e)) }
    setProgress(null)
  }
  // Paste a screenshot straight from the clipboard (Ctrl+V / Cmd+V) while the dialog is open.
  useEffect(() => {
    if (!open) return
    const onPaste = (e: ClipboardEvent) => {
      const img = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile()
      if (img) { e.preventDefault(); handleImage(img) }
    }
    window.addEventListener('paste', onPaste); return () => window.removeEventListener('paste', onPaste)
  }, [open])

  const setRow = (i: number, p: Partial<ParsedStory>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const clean = rows.filter((r) => r.number.trim() && r.title.trim())

  const save = async () => {
    setSaving(true); setError(null)
    try {
      if (pattern !== (room?.adoPattern ?? '') && !patternInvalid) await actions.setAdoPattern(pattern)
      if (clean.length) await actions.addStories(clean.map((r) => ({ ...r, url: linkFor(r, pattern) })), pattern)
      // Only clear the form once everything is saved.
      setSavedNote(clean.length ? `Added ${clean.length} ${clean.length === 1 ? 'story' : 'stories'}.` : 'Link saved.')
      setRows([]); setRaw(''); setPreview(null)
      setTimeout(onClose, 700)
    } catch (e: any) {
      setError(`Couldn't save: ${e?.message ?? e}. Your text is still here, so you can try again.`)
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add stories</DialogTitle>
          <DialogDescription>Drop in a screenshot of the ADO board or paste a list. Screenshots are read on this computer and never uploaded.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="ado">ADO link (optional)</Label>
          <Input id="ado" className="font-mono text-sm" placeholder="Paste any story link from ADO, e.g. https://dev.azure.com/org/project/_workitems/edit/48213" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} />
          {converted && <p className="text-xs text-emerald-700">Got it. Each story will link to <span className="font-mono">{buildAdoUrl(pattern, '12345')}</span> with its own number.</p>}
          {patternInvalid && <p className="text-xs text-amber-700">That link has no story number in it. Paste a link to one story, or add a link per story in the table below.</p>}
          {!linkInput.trim() && <p className="text-xs text-muted-foreground">Paste one story's link and every story gets its own link automatically. You can also set a link per story in the table.</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:bg-secondary/50"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImage(f) }}>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} />
            {preview ? <img src={preview} className="max-h-36 rounded-md" /> : <><ImageUp className="h-8 w-8" /><span>Drop a screenshot, click to choose,<br />or press <kbd className="rounded border bg-muted px-1 font-mono text-xs">Ctrl V</kbd></span></>}
            {progress != null && <span className="flex items-center gap-2 text-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading… {Math.round(progress * 100)}%</span>}
          </label>
          <div className="grid gap-1.5">
            <Label htmlFor="raw">Or type / paste stories (one per line)</Label>
            <Textarea id="raw" className="h-36 font-mono text-xs" placeholder={'48213 Export invoices to CSV\n48214 Add vendor search https://dev.azure.com/…/48214'} value={raw} onChange={(e) => { setRaw(e.target.value); setRows(parseStories(e.target.value)) }} />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead className="w-28">Story #</TableHead><TableHead>Title</TableHead><TableHead className="w-72">ADO link</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell><Input className="h-8 font-mono" value={r.number} onChange={(e) => setRow(i, { number: e.target.value.replace(/\D/g, '') })} /></TableCell>
                  <TableCell><Input className="h-8" value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} /></TableCell>
                  <TableCell><Input className="h-8 font-mono text-xs" placeholder={buildAdoUrl(pattern, r.number) || 'Paste link (optional)'} value={r.url ?? ''} onChange={(e) => setRow(i, { url: e.target.value })} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Remove row" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 /></Button></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={4} className="h-14 text-center text-muted-foreground">No stories yet. Add a screenshot, paste a list, or click “Add row”.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setRows((r) => [...r, { number: '', title: '' }])}><Plus /> Add row</Button>

        {lineup.length > 0 && (
          <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Stories already on the board ({lineup.length}): fix links or remove</summary>
            <div className="mt-2 grid gap-1.5">{lineup.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">#{s.number}</span>
                <span className="w-56 shrink-0 truncate" title={s.title}>{s.title}</span>
                <Input className="h-8 flex-1 font-mono text-xs" placeholder="ADO link" defaultValue={s.url}
                  onBlur={(e) => { const url = e.target.value.trim(); if (url !== s.url) actions.editStory({ ...s, url }) }} />
                <Button variant="ghost" size="sm" onClick={() => actions.removeStory(s.id)}><Trash2 /> Remove</Button>
              </div>
            ))}</div>
          </details>
        )}

        {error && <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {savedNote && <div className="flex items-center gap-2 text-sm text-emerald-700"><Check className="h-4 w-4" />{savedNote}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || (!clean.length && (patternInvalid || pattern === (room?.adoPattern ?? '')))}>
            {saving && <Loader2 className="animate-spin" />}
            {clean.length ? `Add ${clean.length} ${clean.length === 1 ? 'story' : 'stories'}` : 'Save link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
