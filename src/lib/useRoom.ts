import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { makeBackend, setLocalEcho } from './backend'
import { judge } from './consensus'
import { getMyId, forgetMe, setMyId, uid } from './identity'
import { buildAdoUrl, ParsedStory } from './parseStories'
import { isoDate } from './utils'
import type { CardValue, LiveEvent, Member, Room, Snapshot, Sprint, Story } from './types'

/** Someone is "at the table" while their screen checks in (every 30 seconds); 3 minutes of silence means they left. */
export const ONLINE_MS = 3 * 60_000
export const isOnlineAt = (m: { lastSeen: number }, now: number) => now - (m.lastSeen || 0) < ONLINE_MS

/** A story still waiting for points this sprint (not pointed, not skipped). */
export const isOpen = (s: Story) => !s.points && !s.skipped

/** Stories whose number isn't already in the backlog or session (and not repeated within the batch). */
export function onlyNew<T extends { number: string; title?: string }>(existing: { number: string; title?: string }[], rows: T[]): T[] {
  // Same story number = same story. Stories without a number yet are matched by title instead.
  const key = (r: { number: string; title?: string }) => (r.number ? r.number : 't:' + (r.title ?? '').trim().toLowerCase())
  const seen = new Set(existing.map(key))
  return rows.filter((r) => (seen.has(key(r)) ? false : (seen.add(key(r)), true)))
}

/** Renumber stories 0..n in the given order; returns only the ones whose order changed. */
export function reorderRows(stories: Story[], ids: string[]): Story[] {
  const out: Story[] = []
  ids.forEach((id, i) => { const s = stories.find((x) => x.id === id); if (s && s.order !== i) out.push({ ...s, order: i }) })
  return out
}

const EMPTY: Snapshot ={ room: null, members: [], sprints: [], stories: [], votes: [] }

export function useRoom(roomId: string) {
  const db = useMemo(() => makeBackend(roomId), [roomId])
  const meId = useMemo(() => getMyId(roomId), [roomId])
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventHandlers = useRef<Array<(e: LiveEvent) => void>>([])
  // Latest stories, updated right away on our own writes, so back-to-back actions (several screenshots) see each other.
  const storiesRef = useRef<Story[]>([])
  storiesRef.current = snap.stories
  const putLocal = (rows: Story[]) => {
    const ids = new Set(rows.map((r) => r.id))
    storiesRef.current = [...storiesRef.current.filter((s) => !ids.has(s.id)), ...rows]
    setSnap((p) => ({ ...p, stories: [...p.stories.filter((s) => !ids.has(s.id)), ...rows] }))
  }

  const refresh = useCallback(async () => {
    try { setSnap(await db.load()); setError(null) } catch (e: any) { setError(e?.message ?? String(e)) }
  }, [db])

  useEffect(() => {
    const fire = (e: LiveEvent) => eventHandlers.current.forEach((h) => h(e))
    setLocalEcho(fire)
    const off = db.subscribe(refresh, fire)
    ;(async () => {
      try {
        const s = await db.load()
        if (!s.room) {
          const sprint: Sprint = { id: uid(), roomId, name: 'Refinement Session 1', title: '', startedAt: Date.now(), closedAt: null, meetingDate: isoDate(new Date()) }
          const room: Room = { id: roomId, name: 'Point Club', hostId: null, activeSprintId: sprint.id, currentStoryId: null, revealed: false, round: 1, adoPattern: '' }
          await db.ensureRoom(room, sprint)
        }
        await refresh()
      } catch (e: any) { setError(e?.message ?? String(e)) }
      setReady(true)
    })()
    return off
  }, [db, roomId, refresh])

  const { room, members, stories, votes } = snap
  // The backlog is a hidden holding list per room: stories waiting to be picked for an upcoming session.
  const backlogId = `bl-${roomId}`.slice(0, 120)
  // "Next session" is a second hidden list: stories picked for the next meeting, waiting to be put on the table.
  const nextId = `nx-${roomId}`.slice(0, 120)
  const sprints = snap.sprints.filter((s) => s.id !== backlogId && s.id !== nextId)
  const backlog = stories.filter((s) => s.sprintId === backlogId).sort((a, b) => a.order - b.order)
  const upNext = stories.filter((s) => s.sprintId === nextId).sort((a, b) => a.order - b.order)
  const ensureList = async (id: string, name: string) => {
    if (!snap.sprints.some((x) => x.id === id)) await db.upsertSprint({ id, roomId, name, title: '', startedAt: 0, closedAt: null })
  }
  const me = members.find((m) => m.id === meId) ?? null
  const activeSprint = sprints.find((s) => s.id === room?.activeSprintId) ?? null
  const lineup = stories.filter((s) => s.sprintId === activeSprint?.id).sort((a, b) => a.order - b.order)
  const current = stories.find((s) => s.id === room?.currentStoryId) ?? null
  /** The session starts when the dealer picks the first story (or once anything is pointed). Until then, intro music plays. */
  const begun = !!activeSprint?.begunAt || lineup.some((s) => s.points)
  const roundVotes = votes.filter((v) => v.storyId === current?.id && v.round === room?.round)
  const myVote = roundVotes.find((v) => v.memberId === meId)?.value ?? null
  const isHost = !!room && room.hostId === meId
  /** The host is the dealer: runs the board and shows the hand, but doesn't vote (unless they turn on "Vote too"). */
  const isDealer = isHost && !room?.hostVotes
  const result = room?.revealed ? judge(roundVotes.map((v) => v.value)) : null

  // Heartbeat so others can see who has the table open right now (a seat shows only while it beats).
  useEffect(() => {
    if (!me || me.status !== 'here') return
    const beat = () => db.upsertMember({ ...me, lastSeen: Date.now() })
    beat()
    const t = setInterval(beat, 30_000)
    return () => clearInterval(t)
  }, [db, me?.id, me?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Send only the changed fields, so two quick changes (or two people) can't undo each other.
  const patchRoom = (p: Partial<Room>) => room && db.patchRoom(p)
  /** After a story is saved or skipped: go to the next story still needing points, or to the "all done" state. */
  const goToNextOpen = async (from: Story) => {
    const open = (s: Story) => s.id !== from.id && isOpen(s)
    const next = lineup.find((s) => open(s) && s.order > from.order) ?? lineup.find(open)
    await patchRoom({ currentStoryId: next?.id ?? null, revealed: false, round: next ? next.rounds : 1 })
  }

  const actions = {
    onEvent(h: (e: LiveEvent) => void) { eventHandlers.current.push(h); return () => { eventHandlers.current = eventHandlers.current.filter((x) => x !== h) } },
    send: (e: LiveEvent) => db.send(e),

    async join(name: string, character: string) {
      if (!name.trim() || !character) return // everyone picks an avatar
      await db.upsertMember({ id: meId, roomId, name: name.trim(), character, status: 'here', lastSeen: Date.now() })
      if (room && (!room.hostId || !members.some((m) => m.id === room.hostId))) await patchRoom({ hostId: meId })
    },
    async setStatus(status: Member['status']) {
      if (!me) return
      await db.upsertMember({ ...me, status, lastSeen: Date.now() })
      if (status === 'here' && room && !members.some((m) => m.id === room.hostId && m.status === 'here')) await patchRoom({ hostId: meId })
    },
    async updateMe(p: Partial<Pick<Member, 'name' | 'character'>>) { if (me) await db.upsertMember({ ...me, ...p }) },
    /** Returning on a new computer or browser: become your existing self (name, avatar, history, dealer role). */
    becomeMember(id: string) {
      setMyId(roomId, id)
      try { sessionStorage.removeItem(`pointclub:in:${roomId}:${new URLSearchParams(location.search).get('p') ?? ''}`) } catch { /* ignore */ }
      location.reload()
    },
    /** Dealer tidy-up: take someone (e.g. an old test player) off this table's roster. Their past votes stay in history. */
    async removeMember(id: string) { if (id !== meId) await db.removeMember(id) },
    /** Dealer: clear the table's roster (everyone but you). Stories and Past stories stay. People rejoin from the link. */
    async removeEveryoneElse() { for (const m of members) if (m.id !== meId) await db.removeMember(m.id) },
    /** Shared computer: forget who this browser is (they stay in the room, shown as "Not here yet") and start fresh. */
    switchPerson() {
      forgetMe(roomId)
      try { sessionStorage.removeItem(`pointclub:in:${roomId}:${new URLSearchParams(location.search).get('p') ?? ''}`) } catch { /* ignore */ }
      location.reload()
    },
    async leave() { await db.removeMember(meId); forgetMe(roomId); location.reload() },
    async makeHost(memberId: string) { await patchRoom({ hostId: memberId }) },
    async claimHost() { await patchRoom({ hostId: meId }) },

    async vote(value: CardValue) {
      if (!current || !room || room.revealed || current.points || current.skipped || isDealer) return // pointed/skipped stories are locked; the dealer doesn't vote
      const id = `${current.id}:${room.round}:${meId}`
      if (myVote === value) await db.removeVote(id)
      else await db.upsertVote({ id, roomId, storyId: current.id, memberId: meId, round: room.round, value })
    },
    async reveal() { await patchRoom({ revealed: true }) },
    async revote() {
      if (!room || !current) return
      const round = room.round + 1
      await db.upsertStories([{ ...current, rounds: round }])
      await patchRoom({ revealed: false, round })
    },
    async lockIn(points: string) {
      if (!current || !room) return
      const outcome = judge(roundVotes.map((v) => v.value)).outcome
      await db.upsertStories([{ ...current, points, outcome, rounds: room.round, skipped: false }])
      await goToNextOpen(current)
    },
    /** Park the current story for next sprint ("needs more info"), with an optional note, and move on. */
    /**
     * Skip ("needs more info"): the story goes straight back to the top of the backlog with the note, for the next
     * backlog refinement. The table keeps it marked Skipped so this session's history shows it.
     */
    async skipStory(note: string) {
      if (!current || !room) return
      const n = note.trim()
      const marked = { ...current, skipped: true, note: n }
      await ensureList(backlogId, 'Backlog')
      const top = backlog.length ? Math.min(...backlog.map((x) => x.order)) - 1 : 0
      const copy: Story = { ...current, id: uid(), sprintId: backlogId, points: null, outcome: null, rounds: 1, order: top, skipped: false, note: n || 'Skipped: needs more info' }
      putLocal([marked, copy]); await db.upsertStories([marked, copy])
      await goToNextOpen(current)
    },
    /** Changed your mind: point the skipped story now, and take its copy back out of the backlog. */
    async unskipStory() {
      if (!current) return
      const copies = storiesRef.current.filter((s) => s.sprintId === backlogId && s.number === current.number)
      const back = { ...current, skipped: false }
      putLocal([back]); await db.upsertStories([back])
      for (const c of copies) await actions.removeStory(c.id)
    },
    async selectStory(id: string) {
      const s = stories.find((x) => x.id === id)
      // Picking the first story (any one, in any order) starts the session and ends the intro music.
      if (s && activeSprint && !begun) await db.upsertSprint({ ...activeSprint, begunAt: Date.now() })
      // A pointed story opens locked (showing its points); the dealer can revote it on purpose.
      if (s) await patchRoom({ currentStoryId: id, revealed: false, round: s.rounds })
    },
    /** Reopen voting on a story that already has points. */
    async revoteStory() {
      if (!current || !room) return
      const round = current.rounds + 1
      await db.upsertStories([{ ...current, points: null, outcome: null, rounds: round }])
      await patchRoom({ revealed: false, round })
    },
    /** Add stories to the backlog (default) or this session. Numbers already planned are skipped. */
    async addStories(rows: ParsedStory[], pattern = room?.adoPattern ?? '', to: 'backlog' | 'session' = 'backlog') {
      if (!activeSprint || !room) return { added: [] as Story[], skipped: rows.length }
      const all = storiesRef.current
      const planned = all.filter((s) => s.sprintId === backlogId || s.sprintId === nextId || s.sprintId === activeSprint.id)
      const fresh = onlyNew(planned, rows.map((r) => ({ ...r, number: r.number.trim(), title: r.title.trim() })).filter((r) => r.title))
      const target = to === 'backlog' ? backlogId : activeSprint.id
      const list = all.filter((s) => s.sprintId === target)
      if (to === 'backlog' && !snap.sprints.some((s) => s.id === backlogId))
        await db.upsertSprint({ id: backlogId, roomId, name: 'Backlog', title: '', startedAt: 0, closedAt: null })
      const base = list.length ? Math.max(...list.map((s) => s.order)) + 1 : 0
      const created: Story[] = fresh.map((r, i) => ({
        id: uid(), roomId, sprintId: target, number: r.number, title: r.title,
        url: r.url?.trim() || buildAdoUrl(pattern, r.number), points: null, outcome: null, rounds: 1, order: base + i, skipped: false, note: '',
      }))
      if (created.length) { putLocal(created); await db.upsertStories(created) }
      if (to === 'session' && created.length && begun && (!room.currentStoryId || !stories.some((s) => s.id === room.currentStoryId && s.sprintId === activeSprint.id)))
        await patchRoom({ currentStoryId: created[0].id, revealed: false, round: 1 })
      return { added: created, skipped: rows.length - created.length }
    },
    /** Pick backlog stories for this session (in the order given). */
    async moveToSession(ids: string[]) {
      if (!activeSprint || !room || !ids.length) return
      const base = lineup.length ? Math.max(...lineup.map((s) => s.order)) + 1 : 0
      const picked = ids.map((id) => stories.find((s) => s.id === id)).filter(Boolean) as Story[]
      await db.upsertStories(picked.map((s, i) => ({ ...s, sprintId: activeSprint.id, order: base + i, skipped: false })))
      if (!current) await patchRoom({ currentStoryId: picked[0].id, revealed: false, round: picked[0].rounds })
    },
    /** Pick backlog stories for the next meeting (they wait in the Next session list). */
    async moveToNext(ids: string[]) {
      if (!ids.length) return
      await ensureList(nextId, 'Next session')
      const base = upNext.length ? Math.max(...upNext.map((s) => s.order)) + 1 : 0
      const picked = ids.map((id) => stories.find((s) => s.id === id)).filter(Boolean) as Story[]
      // Its refinement note has done its job once it's picked for the next session.
      const moved = picked.map((s, i) => ({ ...s, sprintId: nextId, order: base + i, skipped: false, note: '' }))
      putLocal(moved); await db.upsertStories(moved)
    },
    /** Put everything in the Next session list on the table for pointing; the list empties. */
    async putOnTable() {
      if (!activeSprint || !room || !upNext.length) return
      const base = lineup.length ? Math.max(...lineup.map((s) => s.order)) + 1 : 0
      const moved = upNext.map((s, i) => ({ ...s, sprintId: activeSprint.id, order: base + i, skipped: false }))
      putLocal(moved); await db.upsertStories(moved)
      // Before the session starts the dealer picks which story to point first; after that, the next one comes up.
      if (begun && (!current || current.sprintId !== activeSprint.id)) await patchRoom({ currentStoryId: moved[0].id, revealed: false, round: moved[0].rounds })
    },
    /** Put a story (from the table or the Next session list) back at the top of the backlog. */
    async moveToBacklog(id: string) {
      const s = stories.find((x) => x.id === id)
      if (!s || !room) return
      await ensureList(backlogId, 'Backlog')
      const base = backlog.length ? Math.min(...backlog.map((x) => x.order)) - 1 : 0 // goes to the top of the backlog
      const moved = { ...s, sprintId: backlogId, order: base, points: null, outcome: null, skipped: false }
      putLocal([moved]); await db.upsertStories([moved])
      if (room.currentStoryId === id) await goToNextOpen(s)
    },
    /** Save a new top-to-bottom order for a list (backlog or session). Only stories whose place changed are written. */
    async reorder(ids: string[]) {
      const changed = reorderRows(stories, ids)
      if (!changed.length) return
      putLocal(changed) // no snap-back while saving
      await db.upsertStories(changed)
    },
    /** Dealer only by default; turn on to let the host vote too. Turning it off removes the host's vote this round. */
    async setHostVotes(on: boolean) {
      await patchRoom({ hostVotes: on })
      if (!on && current && room) await db.removeVote(`${current.id}:${room.round}:${meId}`)
    },
    /** Dealer's switch: music on or off for everyone at the table. */
    async setMusicOff(off: boolean) { await patchRoom({ musicOff: off }) },
    async setNextCount(n: number) { await patchRoom({ nextCount: Math.max(1, Math.min(30, Math.round(n))) }) },
    async editStory(s: Story) { putLocal([s]); await db.upsertStories([s]) },
    async removeStory(id: string) {
      storiesRef.current = storiesRef.current.filter((s) => s.id !== id)
      setSnap((p) => ({ ...p, stories: p.stories.filter((s) => s.id !== id) })) // disappears right away
      await db.removeStory(id)
      if (room?.currentStoryId === id) await patchRoom({ currentStoryId: lineup.find((s) => s.id !== id)?.id ?? null, revealed: false, round: 1 })
    },
    async setAdoPattern(adoPattern: string) {
      await patchRoom({ adoPattern })
      // Use the latest stories (an edit may have just landed) and only fill stories that have a number.
      const missing = storiesRef.current.filter((s) => !s.url && s.number).map((s) => ({ ...s, url: buildAdoUrl(adoPattern, s.number) }))
      if (missing.length) { putLocal(missing); await db.upsertStories(missing) }
    },
    /** Dealer: "Let's start". Ends the walk-in music for everyone and opens the first story waiting to be pointed. */
    async beginSession() {
      if (!activeSprint) return
      await db.upsertSprint({ ...activeSprint, begunAt: Date.now() })
      const first = lineup.find(isOpen)
      if (first && (!current || current.sprintId !== activeSprint.id)) await patchRoom({ currentStoryId: first.id, revealed: false, round: first.rounds })
    },
    async renameSprint(p: Partial<Pick<Sprint, 'name' | 'title' | 'meetingDate' | 'begunAt'>>) { if (activeSprint) await db.upsertSprint({ ...activeSprint, ...p }) },
    /** Finish this session. Unpointed stories go back to the top of the backlog, or into the Next session list. */
    async closeAndStartNext(name: string, title: string, carryTo: 'backlog' | 'next' = 'backlog', meetingDate: string | null = null) {
      if (!room) return
      if (activeSprint) await db.upsertSprint({ ...activeSprint, closedAt: Date.now() })
      const next: Sprint = { id: uid(), roomId, name, title, startedAt: Date.now(), closedAt: null, meetingDate }
      await db.upsertSprint(next)
      // Stories that weren't pointed go back to the top of the backlog (with their notes). The finished session
      // keeps a copy marked as skipped, so its history stays accurate.
      const carry = lineup.filter((s) => !s.points && !s.skipped) // skipped ones are already back in the backlog
      if (carry.length) {
        const dest = carryTo === 'next' ? nextId : backlogId
        const destList = carryTo === 'next' ? upNext : backlog
        await ensureList(dest, carryTo === 'next' ? 'Next session' : 'Backlog')
        const top = destList.length ? Math.min(...destList.map((x) => x.order)) - carry.length : 0
        await db.upsertStories(carry.map((s) => ({ ...s, skipped: true })))
        await db.upsertStories(carry.map((s, i) => ({
          ...s, id: uid(), sprintId: dest, points: null, outcome: null, rounds: 1, order: top + i, skipped: false,
          note: carryTo === 'next' ? '' : s.note ? `Not pointed last session: ${s.note.replace(/^(Carried from[^:]*|Not pointed last session): /, '')}` : 'Not pointed last session',
        })))
      }
      await patchRoom({ activeSprintId: next.id, currentStoryId: null, revealed: false, round: 1 })
    },
  }

  return { ready, error, mode: db.mode, meId, me, room, members, sprints, stories, votes, activeSprint, lineup, backlog, upNext, current, roundVotes, myVote, isHost, isDealer, begun, result, actions }
}
export type RoomApi = ReturnType<typeof useRoom>
