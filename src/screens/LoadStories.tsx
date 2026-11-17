import { useEffect, useState } from 'react'
import { ImageUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { readImage } from '@/lib/ocr'
import { buildAdoUrl, ParsedStory, parseStories } from '@/lib/parseStories'
import type { RoomApi } from '@/lib/useRoom'

export function LoadStories({ api, open, onClose }: { api: RoomApi; open: boolean; onClose: () => void }) {
  const { room, lineup, actions } = api
  const [pattern, setPattern] = useState(room?.adoPattern ?? '')
  const [rows, setRows] = useState<ParsedStory[]>([])
  const [raw, setRaw] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => { if (open) setPattern(room?.adoPattern ?? '') }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleImage = async (file: Blob) => {
    setPreview(URL.createObjectURL(file)); setProgress(0)
    try { const text = await readImage(file, setProgress); setRaw(text); setRows(parseStories(text)) }
    catch (e: any) { alert('Could not read the image: ' + (e?.message ?? e)) }
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
  const save = async () => {
    if (pattern !== room?.adoPattern) await actions.setAdoPattern(pattern)
    const clean = rows.filter((r) => r.number.trim() && r.title.trim())
    if (clean.length) await actions.addStories(clean, pattern)
    setRows([]); setRaw(''); setPreview(null); onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Load targets</DialogTitle>
          <DialogDescription>Drop in a screenshot of the ADO board. It's read on this computer and never uploaded.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="ado">ADO story link pattern</Label>
          <Input id="ado" className="font-mono" placeholder="https://dev.azure.com/your-org/your-project/_workitems/edit/{id}" value={pattern} onChange={(e) => setPattern(e.target.value)} />
          <p className="text-xs text-muted-foreground">Put <code className="font-mono">{'{id}'}</code> where the story number goes.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:bg-secondary/50"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImage(f) }}>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} />
            {preview ? <img src={preview} className="max-h-40 rounded-md" /> : <><ImageUp className="h-8 w-8" /><span>Drop a screenshot, click to choose,<br />or press <kbd className="rounded border bg-muted px-1 font-mono text-xs">Ctrl V</kbd></span></>}
            {progress != null && <span className="flex items-center gap-2 text-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading… {Math.round(progress * 100)}%</span>}
          </label>
          <div className="grid gap-1.5">
            <Label htmlFor="raw">Or paste text (one story per line)</Label>
            <Textarea id="raw" className="h-40 font-mono text-xs" placeholder={'48213 Export invoices to CSV\n48214 Add vendor search'} value={raw} onChange={(e) => { setRaw(e.target.value); setRows(parseStories(e.target.value)) }} />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead className="w-32">Story #</TableHead><TableHead>Title</TableHead><TableHead className="w-64">ADO link</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell><Input className="h-8 font-mono" value={r.number} onChange={(e) => setRow(i, { number: e.target.value.replace(/\D/g, '') })} /></TableCell>
                  <TableCell><Input className="h-8" value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} /></TableCell>
                  <TableCell className="max-w-64 truncate font-mono text-xs text-muted-foreground">{buildAdoUrl(pattern, r.number) || '–'}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 /></Button></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">No stories found yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setRows((r) => [...r, { number: '', title: '' }])}><Plus /> Add row</Button>

        {lineup.length > 0 && (
          <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Manage current targets ({lineup.length})</summary>
            <div className="mt-2 grid gap-1">{lineup.map((s) => (
              <div key={s.id} className="flex items-center gap-2"><span className="w-20 font-mono text-xs text-muted-foreground">#{s.number}</span><span className="flex-1 truncate">{s.title}</span>
                <Button variant="ghost" size="sm" onClick={() => actions.removeStory(s.id)}><Trash2 /> Remove</Button></div>
            ))}</div>
          </details>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{rows.length ? `Add ${rows.length} to the board` : 'Save link pattern'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
