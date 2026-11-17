import { useState } from 'react'
import { Armchair, Palmtree, Pencil, LogOut, ArrowRight } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CAST, castById } from '@/lib/cast'
import { cn, sessionName } from '@/lib/utils'
import type { RoomApi } from '@/lib/useRoom'

export function Lobby({ api, onEnter }: { api: RoomApi; onEnter: () => void }) {
  const { me, members, activeSprint, actions } = api
  const taken = new Set(members.filter((m) => m.id !== me?.id).map((m) => m.character))
  const [name, setName] = useState(me?.name ?? '')
  // Nobody gets an avatar by default: each person picks one before taking a seat.
  const [character, setCharacter] = useState<string>(me?.character ?? '')
  const ready = !!name.trim() && !!character && !taken.has(character)
  const [editing, setEditing] = useState(!me)
  const sprintLine = <>{sessionName(activeSprint?.name)}</>

  if (me && !editing) {
    const c = castById(me.character)
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="w-[440px]">
          <CardHeader className="items-center text-center">
            <Avatar character={me.character} name={me.name} size={112} mood="cheer" />
            <CardTitle className="text-2xl pt-3">Welcome back, {me.name}</CardTitle>
            <CardDescription>{me.status === "away" ? "Marked away" : "Good to see you again."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button size="lg" onClick={async () => { await actions.setStatus('here'); onEnter() }}><Armchair /> Take my seat</Button>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={async () => { await actions.setStatus('away'); onEnter() }}><Palmtree /> Away</Button>
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Change</Button>
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => confirm('Remove yourself from this room? You can always join again.') && actions.leave()}><LogOut /> Remove</Button>
            </div>
          </CardContent>
          <CardFooter className="justify-center text-xs text-muted-foreground">Now: {sprintLine}</CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="w-[880px] max-w-full">
        <CardHeader>
          <Logo />
          <CardTitle className="text-2xl pt-4">Pick your avatar</CardTitle>
          <CardDescription>Now: {sprintLine}. No login: this browser remembers you next time.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-2">
            {CAST.map((c) => {
              const isTaken = taken.has(c.id), sel = character === c.id
              return (
                <button key={c.id} disabled={isTaken} onClick={() => setCharacter(c.id)}
                  className={cn('rounded-lg border p-3 flex flex-col items-center gap-2 transition-colors disabled:opacity-40', sel ? 'border-primary bg-secondary ring-1 ring-primary' : 'border-transparent hover:bg-secondary')}>
                  <Avatar character={c.id} size={60} mood={sel ? 'cheer' : 'idle'} dim={isTaken} />
                  {isTaken && <span className="text-[10px] text-muted-foreground leading-tight">Taken</span>}
                </button>
              )
            })}
          </div>
        </CardContent>
        <CardFooter>
          <form className="flex w-full items-end gap-3" onSubmit={async (e) => { e.preventDefault(); if (!ready) return; if (me) await actions.updateMe({ name: name.trim(), character }); else await actions.join(name, character); onEnter() }}>
            <div className="grid gap-1.5 flex-1 max-w-sm">
              <Label htmlFor="name">First name</Label>
              <Input id="name" placeholder="Your first name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={24} />
            </div>
            <div className="grid justify-items-end gap-1">
              {!character && <span className="text-xs text-amber-700" data-testid="pick-hint">Pick an avatar above first.</span>}
              <Button disabled={!ready}>Take my seat <ArrowRight /></Button>
            </div>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}
