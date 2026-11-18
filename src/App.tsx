import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRoom } from './lib/useRoom'
import { Landing } from './screens/Landing'
import { Lobby } from './screens/Lobby'
import { Theater } from './screens/Theater'
import { Vault } from './screens/Vault'
import { Planner } from './screens/Planner'
import { Agenda } from './screens/Agenda'

/** The table id from a short link (pointclub…app/abc123) or an older one (…app/?room=abc123). */
function roomFromUrl(): string | null {
  const q = new URLSearchParams(location.search)
  const fromQuery = q.get('room')
  if (fromQuery) {
    // Tidy the address bar to the short form, keeping any other options (p=, agenda=).
    q.delete('room'); const rest = q.toString()
    try { history.replaceState(null, '', `/${fromQuery}${rest ? '?' + rest : ''}`) } catch { /* ignore */ }
    return fromQuery
  }
  const seg = location.pathname.replace(/^\/+|\/+$/g, '')
  return /^[A-Za-z0-9_-]{4,60}$/.test(seg) ? seg : null
}

export default function App() {
  const [roomId] = useState(roomFromUrl)
  return <TooltipProvider delayDuration={200}><div className="min-h-screen">{roomId ? <RoomApp roomId={roomId} /> : <Landing />}</div></TooltipProvider>
}

const inKey = (roomId: string) => `pointclub:in:${roomId}:${new URLSearchParams(location.search).get('p') ?? ''}`

function RoomApp({ roomId }: { roomId: string }) {
  const api = useRoom(roomId)
  const [view, setView] = useState<'theater' | 'vault' | 'planner'>('theater')
  const [checkedIn, setCheckedIn] = useState(() => { try { return sessionStorage.getItem(inKey(roomId)) === '1' } catch { return false } })
  useEffect(() => { try { sessionStorage.setItem(inKey(roomId), checkedIn ? '1' : '0') } catch { /* */ } }, [checkedIn])
  // Coming back next week with the same link: you go straight to your seat (your avatar and name are remembered).
  useEffect(() => {
    if (api.ready && api.me && !checkedIn) {
      if (api.me.status !== 'here') api.actions.setStatus('here')
      setCheckedIn(true)
    }
  }, [api.ready, api.me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!api.ready) return <div className="grid place-items-center h-screen text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (api.error) return <div className="p-10 text-destructive">Couldn't reach the table: {api.error}</div>
  // Read-only agenda link: anyone can see the upcoming stories without joining.
  if (new URLSearchParams(location.search).get('agenda')) return <Agenda api={api} />
  if (!api.me || !checkedIn) return <Lobby api={api} onEnter={() => setCheckedIn(true)} />
  if (view === 'vault') return <Vault api={api} onBack={() => setView('theater')} />
  if (view === 'planner') return <Planner api={api} onBack={() => setView('theater')} />
  return <Theater api={api} openVault={() => setView('vault')} openPlanner={() => setView('planner')} onLobby={() => setCheckedIn(false)} />
}
