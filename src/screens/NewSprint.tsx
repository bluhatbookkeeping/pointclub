import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sessionName } from '@/lib/utils'
import type { RoomApi } from '@/lib/useRoom'

/** "Finish session": save this pointing session to Past stories and open a fresh one. */
export function NewSprint({ api, open, onClose }: { api: RoomApi; open: boolean; onClose: () => void }) {
  const cur = api.activeSprint
  const nextNum = (Number(cur?.name.match(/\d+/)?.[0]) || api.sprints.length) + 1
  const [name, setName] = useState(`Session ${nextNum}`)
  useEffect(() => { if (open) setName(`Session ${nextNum}`) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const pointed = api.lineup.filter((s) => s.points).length
  const left = api.lineup.filter((s) => !s.points).length
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); await api.actions.closeAndStartNext(name, ''); onClose() }}>
          <DialogHeader>
            <DialogTitle>Finish session</DialogTitle>
            <DialogDescription>
              Saves {sessionName(cur?.name)} ({pointed} {pointed === 1 ? 'story' : 'stories'} pointed) to Past stories and opens a fresh session.
              {left ? ` ${left} ${left === 1 ? 'story that wasn’t pointed goes' : 'stories that weren’t pointed go'} back to the backlog.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="sn">Name for the next session</Label><Input id="sn" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Finish session</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
