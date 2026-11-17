import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RoomApi } from '@/lib/useRoom'

export function NewSprint({ api, open, onClose }: { api: RoomApi; open: boolean; onClose: () => void }) {
  const cur = api.activeSprint
  const nextNum = (Number(cur?.name.match(/\d+/)?.[0]) || api.sprints.length) + 1
  const [name, setName] = useState(`Sprint ${nextNum}`)
  const [title, setTitle] = useState('')
  useEffect(() => { if (open) { setName(`Sprint ${nextNum}`); setTitle('') } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const unpointed = api.lineup.filter((s) => !s.points).length
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); await api.actions.closeAndStartNext(name, title); onClose() }}>
          <DialogHeader>
            <DialogTitle>Wrap the job</DialogTitle>
            <DialogDescription>Close {cur?.name}, show everyone the take, and file it in Case Files.{unpointed ? ` ${unpointed} unpointed ${unpointed === 1 ? 'story stays' : 'stories stay'} with ${cur?.name}.` : ''}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="sn">Next sprint</Label><Input id="sn" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="st">Codename (optional)</Label><Input id="st" placeholder="e.g. Operation Invoice" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Wrap & start {name}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
