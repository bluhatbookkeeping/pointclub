import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { nextWeek, sessionName } from '@/lib/utils'
import type { RoomApi } from '@/lib/useRoom'

/** "Finish session": save this pointing session to Past stories and open a fresh one. */
export function NewSprint({ api, open, onClose }: { api: RoomApi; open: boolean; onClose: () => void }) {
  const cur = api.activeSprint
  const nextNum = (Number(cur?.name.match(/\d+/)?.[0]) || api.sprints.length) + 1
  const [name, setName] = useState(`Refinement Session ${nextNum}`)
  const [carryTo, setCarryTo] = useState<'backlog' | 'next'>('next')
  const [date, setDate] = useState(() => nextWeek(cur))
  useEffect(() => { if (open) { setName(`Refinement Session ${nextNum}`); setCarryTo('next'); setDate(nextWeek(cur)) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const pointed = api.lineup.filter((s) => s.points).length
  const left = api.lineup.filter((s) => !s.points && !s.skipped).length
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); await api.actions.closeAndStartNext(name, '', carryTo, date || null); onClose() }}>
          <DialogHeader>
            <DialogTitle>Finish {sessionName(cur?.name) || 'session'}</DialogTitle>
            <DialogDescription>
              Saves {pointed} pointed {pointed === 1 ? 'story' : 'stories'} to Past stories and clears the table for the next refinement session.
            </DialogDescription>
          </DialogHeader>
          {left > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{left} {left === 1 ? 'story wasn’t' : 'stories weren’t'} pointed. Where should {left === 1 ? 'it' : 'they'} go?</legend>
              {([['next', 'Into next week’s session', 'They show up first in the Next session list.'], ['backlog', 'Back to the top of the backlog', 'Pick them again later.']] as const).map(([k, t, d]) => (
                <label key={k} className={'flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm ' + (carryTo === k ? 'border-primary bg-primary/5' : '')}>
                  <input type="radio" name="carry" className="mt-0.5 accent-[hsl(var(--primary))]" checked={carryTo === k} onChange={() => setCarryTo(k)} />
                  <span><span className="font-medium">{t}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="grid grid-cols-[1fr_11rem] gap-3">
            <div className="grid gap-1.5"><Label htmlFor="sn">Name for the next refinement session</Label><Input id="sn" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label htmlFor="sd">Meeting date</Label><Input id="sd" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Finish session</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
