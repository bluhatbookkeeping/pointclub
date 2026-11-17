import { useEffect, useState } from 'react'
import { readImage } from '../lib/ocr'
import { buildAdoUrl, ParsedStory, parseStories } from '../lib/parseStories'
import type { RoomApi } from '../lib/useRoom'

export function LoadStories({ api, onClose }: { api: RoomApi; onClose: () => void }) {
  const { room, lineup, actions } = api
  const [pattern, setPattern] = useState(room?.adoPattern ?? '')
  const [rows, setRows] = useState<ParsedStory[]>([])
  const [raw, setRaw] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleImage = async (file: Blob) => {
    setPreview(URL.createObjectURL(file)); setProgress(0)
    try {
      const text = await readImage(file, setProgress)
      setRaw(text); setRows(parseStories(text))
    } catch (e: any) { alert('Could not read the image: ' + (e?.message ?? e)) }
    setProgress(null)
  }
  // Paste a screenshot straight from the clipboard (Ctrl+V / Cmd+V).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const img = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))?.getAsFile()
      if (img) { e.preventDefault(); handleImage(img) }
    }
    window.addEventListener('paste', onPaste); return () => window.removeEventListener('paste', onPaste)
  }, [])

  const setRow = (i: number, p: Partial<ParsedStory>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const save = async () => {
    if (pattern !== room?.adoPattern) await actions.setAdoPattern(pattern)
    const clean = rows.filter((r) => r.number.trim() && r.title.trim())
    if (clean.length) await actions.addStories(clean, pattern)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-6" onClick={onClose}>
      <div className="marquee-frame p-6 w-[980px] max-w-full max-h-[92vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-4"><h2 className="font-display text-2xl text-marquee-400">📸 Load tonight's lineup</h2><button className="ml-auto btn-ghost" onClick={onClose}>✕</button></div>

        <label className="block text-sm text-white/70 mb-1">ADO story link pattern (use <code className="text-marquee-300">{'{id}'}</code> where the story number goes)</label>
        <input className="input w-full mb-5 font-mono text-sm" placeholder="https://dev.azure.com/your-org/your-project/_workitems/edit/{id}" value={pattern} onChange={(e) => setPattern(e.target.value)} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block rounded-xl border-2 border-dashed border-white/20 hover:border-marquee-400 p-6 text-center cursor-pointer min-h-40"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImage(f) }}>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} />
              {preview ? <img src={preview} className="max-h-48 mx-auto rounded" /> : <div className="text-white/60 py-8">Drop a screenshot of the ADO board here,<br />click to choose one, or press <b>Ctrl+V</b> to paste.</div>}
              {progress != null && <div className="mt-3 text-marquee-300 text-sm">Reading the screenshot… {Math.round(progress * 100)}%</div>}
            </label>
            <p className="text-xs text-white/40 mt-2">The image is read on this computer and never uploaded.</p>
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">…or paste / fix the text (one story per line: <code>48213 Export invoices</code>)</label>
            <textarea className="input w-full h-44 font-mono text-xs" value={raw} onChange={(e) => { setRaw(e.target.value); setRows(parseStories(e.target.value)) }} />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center mb-2"><h3 className="font-semibold">Found {rows.length} {rows.length === 1 ? 'story' : 'stories'}. Check them before adding.</h3>
            <button className="ml-auto btn-ghost text-sm" onClick={() => setRows((r) => [...r, { number: '', title: '' }])}>+ Add row</button></div>
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-white/50 bg-white/5"><tr><th className="p-2 w-32">Story #</th><th className="p-2">Title</th><th className="p-2 w-64">ADO link</th><th className="w-10" /></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="p-1"><input className="input w-full py-1" value={r.number} onChange={(e) => setRow(i, { number: e.target.value.replace(/\D/g, '') })} /></td>
                    <td className="p-1"><input className="input w-full py-1" value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} /></td>
                    <td className="p-1 text-xs text-white/50 truncate max-w-64">{buildAdoUrl(pattern, r.number) || '–'}</td>
                    <td className="p-1"><button className="text-white/40 hover:text-red-300" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>✕</button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-white/40">Nothing yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {lineup.length > 0 && (
          <details className="mt-4 text-sm"><summary className="cursor-pointer text-white/60">Manage current lineup ({lineup.length})</summary>
            <div className="mt-2 grid gap-1">{lineup.map((s) => (
              <div key={s.id} className="flex gap-2 items-center"><span className="text-marquee-300 w-20">#{s.number}</span><span className="flex-1 truncate">{s.title}</span>
                <button className="text-white/40 hover:text-red-300" onClick={() => actions.removeStory(s.id)}>Remove</button></div>
            ))}</div>
          </details>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={save}>{rows.length ? `Add ${rows.length} to tonight's lineup` : 'Save link pattern'}</button>
        </div>
      </div>
    </div>
  )
}
