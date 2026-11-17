import { useEffect, useState } from 'react'
import { useRoom } from './lib/useRoom'
import { Landing } from './screens/Landing'
import { Lobby } from './screens/Lobby'
import { Theater } from './screens/Theater'
import { Vault } from './screens/Vault'

function roomFromUrl() { return new URLSearchParams(location.search).get('room') }

export default function App() {
  const roomId = roomFromUrl()
  return (
    <div className="film-grain min-h-screen">
      <div className="curtain-l" /><div className="curtain-r" />
      <div className="relative z-10 px-16">{roomId ? <RoomApp roomId={roomId} /> : <Landing />}</div>
    </div>
  )
}

function RoomApp({ roomId }: { roomId: string }) {
  const api = useRoom(roomId)
  const [view, setView] = useState<'theater' | 'vault'>('theater')
  const [checkedIn, setCheckedIn] = useState(() => { try { return sessionStorage.getItem('pointclub:in:' + location.search) === '1' } catch { return false } })
  useEffect(() => { try { sessionStorage.setItem('pointclub:in:' + location.search, checkedIn ? '1' : '0') } catch { /* */ } }, [checkedIn, roomId])

  if (!api.ready) return <div className="grid place-items-center h-screen font-display text-marquee-400 text-2xl animate-pulse">Warming up the projector…</div>
  if (api.error) return <div className="p-10 text-red-300">Couldn't reach the theater: {api.error}</div>

  // A removed member (e.g. removed in another tab) goes back to the lobby.
  if (!api.me || !checkedIn) return <Lobby api={api} onEnter={() => setCheckedIn(true)} />
  if (view === 'vault') return <Vault api={api} onBack={() => setView('theater')} />
  return <Theater api={api} openVault={() => setView('vault')} onLobby={() => setCheckedIn(false)} />
}
