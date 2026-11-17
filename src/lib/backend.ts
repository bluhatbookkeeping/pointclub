import type { LiveEvent, Member, Room, Snapshot, Sprint, Story, Vote } from './types'

export interface Backend {
  mode: 'local' | 'api'
  load(): Promise<Snapshot>
  subscribe(onChange: () => void, onEvent: (e: LiveEvent) => void): () => void
  send(e: LiveEvent): void
  upsertRoom(r: Room): Promise<void>
  /** Create the room and its first sprint only if the room doesn't exist yet (safe when several people arrive at once). */
  ensureRoom(r: Room, s: Sprint): Promise<void>
  /** Change only the given room fields, never overwriting the rest with a stale copy. */
  patchRoom(p: Partial<Room>): Promise<void>
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
  async ensureRoom(r: Room, s: Sprint) {
    if (this.read<Room>('rooms')[r.id]) return
    await this.upsertRoom(r); await this.upsertSprint(s)
  }
  async patchRoom(p: Partial<Room>) {
    this.write('rooms', (x) => { const cur = x[this.roomId]; if (cur) x[this.roomId] = { ...cur, ...p, id: this.roomId } })
  }
  async upsertMember(m: Member) { this.write('members', (x) => (x[m.id] = m)) }
  async removeMember(id: string) { this.write('members', (x) => delete x[id]) }
  async upsertSprint(s: Sprint) { this.write('sprints', (x) => (x[s.id] = s)) }
  async upsertStories(s: Story[]) { this.write('stories', (x) => s.forEach((st) => (x[st.id] = st))) }
  async removeStory(id: string) { this.write('stories', (x) => delete x[id]) }
  async upsertVote(v: Vote) { this.write('votes', (x) => (x[v.id] = v)) }
  async removeVote(id: string) { this.write('votes', (x) => delete x[id]) }
}

/* ---------- Team mode: Vercel API + Neon Postgres, polled about once a second ---------- */
const CLIENT_ID = Math.random().toString(36).slice(2)

class ApiBackend implements Backend {
  mode = 'api' as const
  private version = -1
  private lastEvent = -1
  private snap: Snapshot | null = null
  private onChange: () => void = () => {}
  private onEvent: (e: LiveEvent) => void = () => {}
  private timer: ReturnType<typeof setTimeout> | undefined
  private lastChangeAt = Date.now()
  private stopped = false
  private inflight: Promise<void> | null = null
  constructor(private roomId: string) {}
  private url() { return `/api/room?id=${encodeURIComponent(this.roomId)}` }

  private async poll() {
    if (this.inflight) return this.inflight
    this.inflight = (async () => {
      const r = await fetch(`${this.url()}&v=${this.version}&e=${this.lastEvent}`, { cache: 'no-store' })
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`)
      const j = await r.json()
      this.lastEvent = j.lastEvent
      for (const e of j.events ?? []) if (e?._cid !== CLIENT_ID) this.onEvent(e)
      if (!j.unchanged) {
        this.version = j.version; this.snap = j.snapshot; this.lastChangeAt = Date.now()
        this.onChange()
      }
    })().finally(() => { this.inflight = null })
    return this.inflight
  }
  private schedule() {
    if (this.stopped) return
    const idle = Date.now() - this.lastChangeAt > 120_000
    const delay = document.hidden ? 5000 : idle ? 3000 : 1000
    this.timer = setTimeout(() => this.poll().catch(() => {}).finally(() => this.schedule()), delay)
  }
  async load(): Promise<Snapshot> {
    if (!this.snap) await this.poll()
    return this.snap ?? { room: null, members: [], sprints: [], stories: [], votes: [] }
  }
  subscribe(onChange: () => void, onEvent: (e: LiveEvent) => void) {
    this.onChange = onChange; this.onEvent = onEvent; this.stopped = false
    const wake = () => { if (!document.hidden) { clearTimeout(this.timer); this.poll().catch(() => {}).finally(() => this.schedule()) } }
    document.addEventListener('visibilitychange', wake)
    this.schedule()
    return () => { this.stopped = true; clearTimeout(this.timer); document.removeEventListener('visibilitychange', wake) }
  }
  private async post(op: string, data: unknown) {
    const r = await fetch(this.url(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, data }) })
    if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`)
    this.lastChangeAt = Date.now()
    if (op !== 'event') await this.poll().catch(() => {}) // show my own change right away
  }
  send(e: LiveEvent) { onLocal(e); this.post('event', { ...e, _cid: CLIENT_ID }).catch(() => {}) }
  upsertRoom(r: Room) { return this.post('upsertRoom', r) }
  patchRoom(p: Partial<Room>) { return this.post('patchRoom', p) }
  ensureRoom(room: Room, sprint: Sprint) { return this.post('ensureRoom', { room, sprint }) }
  upsertMember(m: Member) { return this.post('upsertMember', m) }
  removeMember(id: string) { return this.post('removeMember', { id }) }
  upsertSprint(s: Sprint) { return this.post('upsertSprint', s) }
  upsertStories(s: Story[]) { return this.post('upsertStories', s) }
  removeStory(id: string) { return this.post('removeStory', { id }) }
  upsertVote(v: Vote) { return this.post('upsertVote', v) }
  removeVote(id: string) { return this.post('removeVote', { id }) }
}
// The sender plays its own live events immediately; the server copy is skipped by client id.
let onLocal: (e: LiveEvent) => void = () => {}
export const setLocalEcho = (f: (e: LiveEvent) => void) => { onLocal = f }

export function makeBackend(roomId: string): Backend {
  // The built site (Vercel) is always team mode, so a missing setting can't split the team into private tables.
  // Demo mode is only for local tries: `npm run dev`, or a build made with VITE_BACKEND=local.
  const v = import.meta.env.VITE_BACKEND
  if (v === 'api' || (import.meta.env.PROD && v !== 'local')) return new ApiBackend(roomId)
  return new LocalBackend(roomId)
}
