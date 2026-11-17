import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { LiveEvent, Member, Room, Snapshot, Sprint, Story, Vote } from './types'

export interface Backend {
  mode: 'local' | 'supabase'
  load(): Promise<Snapshot>
  subscribe(onChange: () => void, onEvent: (e: LiveEvent) => void): () => void
  send(e: LiveEvent): void
  upsertRoom(r: Room): Promise<void>
  upsertMember(m: Member): Promise<void>
  removeMember(id: string): Promise<void>
  upsertSprint(s: Sprint): Promise<void>
  upsertStories(s: Story[]): Promise<void>
  removeStory(id: string): Promise<void>
  upsertVote(v: Vote): Promise<void>
  removeVote(id: string): Promise<void>
}

type Table = 'rooms' | 'members' | 'sprints' | 'stories' | 'votes'

/* ---------- Local demo: localStorage + BroadcastChannel (tabs in one browser) ---------- */
class LocalBackend implements Backend {
  mode = 'local' as const
  private ch: BroadcastChannel
  private listeners: Array<(msg: { type: 'change' } | { type: 'event'; e: LiveEvent }) => void> = []
  constructor(private roomId: string) {
    this.ch = new BroadcastChannel('pointclub:' + roomId)
    this.ch.onmessage = (ev) => this.listeners.forEach((l) => l(ev.data))
  }
  private k(t: Table) { return `pointclub:db:${this.roomId}:${t}` }
  private read<T>(t: Table): Record<string, T> { try { return JSON.parse(localStorage.getItem(this.k(t)) || '{}') } catch { return {} } }
  private write(t: Table, f: (rows: Record<string, any>) => void) {
    const rows = this.read<any>(t); f(rows); localStorage.setItem(this.k(t), JSON.stringify(rows))
    const msg = { type: 'change' as const }
    this.ch.postMessage(msg); this.listeners.forEach((l) => l(msg))
  }
  async load(): Promise<Snapshot> {
    const room = this.read<Room>('rooms')[this.roomId] ?? null
    return {
      room,
      members: Object.values(this.read<Member>('members')),
      sprints: Object.values(this.read<Sprint>('sprints')),
      stories: Object.values(this.read<Story>('stories')),
      votes: Object.values(this.read<Vote>('votes')),
    }
  }
  subscribe(onChange: () => void, onEvent: (e: LiveEvent) => void) {
    const l = (m: any) => (m.type === 'change' ? onChange() : onEvent(m.e))
    this.listeners.push(l)
    return () => { this.listeners = this.listeners.filter((x) => x !== l) }
  }
  send(e: LiveEvent) { const m = { type: 'event' as const, e }; this.ch.postMessage(m); this.listeners.forEach((l) => l(m)) }
  async upsertRoom(r: Room) { this.write('rooms', (x) => (x[r.id] = r)) }
  async upsertMember(m: Member) { this.write('members', (x) => (x[m.id] = m)) }
  async removeMember(id: string) { this.write('members', (x) => delete x[id]) }
  async upsertSprint(s: Sprint) { this.write('sprints', (x) => (x[s.id] = s)) }
  async upsertStories(s: Story[]) { this.write('stories', (x) => s.forEach((st) => (x[st.id] = st))) }
  async removeStory(id: string) { this.write('stories', (x) => delete x[id]) }
  async upsertVote(v: Vote) { this.write('votes', (x) => (x[v.id] = v)) }
  async removeVote(id: string) { this.write('votes', (x) => delete x[id]) }
}

/* ---------- Supabase: Postgres tables + Realtime ---------- */
const toSnake = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()), v]))
const toCamel = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]))

class SupabaseBackend implements Backend {
  mode = 'supabase' as const
  private live: ReturnType<SupabaseClient['channel']> | null = null
  constructor(private sb: SupabaseClient, private roomId: string) {}
  private async all<T>(t: Table, col = 'room_id'): Promise<T[]> {
    const { data, error } = await this.sb.from(t).select('*').eq(col, this.roomId)
    if (error) throw error
    return (data ?? []).map((r) => toCamel(r) as T)
  }
  async load(): Promise<Snapshot> {
    const [rooms, members, sprints, stories, votes] = await Promise.all([
      this.all<Room>('rooms', 'id'), this.all<Member>('members'), this.all<Sprint>('sprints'), this.all<Story>('stories'), this.all<Vote>('votes'),
    ])
    return { room: rooms[0] ?? null, members, sprints, stories, votes }
  }
  subscribe(onChange: () => void, onEvent: (e: LiveEvent) => void) {
    let t: ReturnType<typeof setTimeout> | undefined
    const bump = () => { clearTimeout(t); t = setTimeout(onChange, 60) }
    const ch = this.sb.channel('room:' + this.roomId)
    for (const table of ['members', 'sprints', 'stories', 'votes'] as Table[])
      ch.on('postgres_changes' as any, { event: '*', schema: 'public', table, filter: `room_id=eq.${this.roomId}` }, bump)
    ch.on('postgres_changes' as any, { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${this.roomId}` }, bump)
    ch.on('broadcast', { event: 'live' }, ({ payload }) => onEvent(payload as LiveEvent))
    ch.subscribe()
    this.live = ch
    return () => { clearTimeout(t); this.sb.removeChannel(ch) }
  }
  send(e: LiveEvent) { onLocal(e); this.live?.send({ type: 'broadcast', event: 'live', payload: e }) }
  private async up(t: Table, rows: Record<string, any>[]) { const { error } = await this.sb.from(t).upsert(rows.map(toSnake)); if (error) throw error }
  private async del(t: Table, id: string) { const { error } = await this.sb.from(t).delete().eq('id', id); if (error) throw error }
  upsertRoom(r: Room) { return this.up('rooms', [r]) }
  upsertMember(m: Member) { return this.up('members', [m]) }
  removeMember(id: string) { return this.del('members', id) }
  upsertSprint(s: Sprint) { return this.up('sprints', [s]) }
  upsertStories(s: Story[]) { return this.up('stories', s) }
  removeStory(id: string) { return this.del('stories', id) }
  upsertVote(v: Vote) { return this.up('votes', [v]) }
  removeVote(id: string) { return this.del('votes', id) }
}
// Supabase broadcast does not echo to the sender, so the sender plays its own event.
let onLocal: (e: LiveEvent) => void = () => {}
export const setLocalEcho = (f: (e: LiveEvent) => void) => { onLocal = f }

export function makeBackend(roomId: string): Backend {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (url && key) return new SupabaseBackend(createClient(url, key), roomId)
  return new LocalBackend(roomId)
}
