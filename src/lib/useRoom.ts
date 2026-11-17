import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { makeBackend, setLocalEcho } from './backend'
import { judge } from './consensus'
import { getMyId, forgetMe, uid } from './identity'
import { buildAdoUrl, ParsedStory } from './parseStories'
import type { CardValue, LiveEvent, Member, Room, Snapshot, Sprint, Story } from './types'

/** A story still waiting for points this sprint (not pointed, not skipped). */
export const isOpen = (s: Story) => !s.points && !s.skipped

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
          const sprint: Sprint = { id: uid(), roomId, name: 'Session 1', title: '', startedAt: Date.now(), closedAt: null }
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
  const sprints = snap.sprints.filter((s) => s.id !== backlogId)
  const backlog = stories.filter((s) => s.sprintId === backlogId).sort((a, b) => a.order - b.order)
  const me = members.find((m) => m.id === meId) ?? null
  const activeSprint = sprints.find((s) => s.id === room?.activeSprintId) ?? null
  const lineup = stories.filter((s) => s.sprintId === activeSprint?.id).sort((a, b) => a.order - b.order)
  const current = stories.find((s) => s.id === room?.currentStoryId) ?? null
  const roundVotes = votes.filter((v) => v.storyId === current?.id && v.round === room?.round)
  const myVote = roundVotes.find((v) => v.memberId === meId)?.value ?? null
  const isHost = !!room && room.hostId === meId
  const result = room?.revealed ? judge(roundVotes.map((v) => v.value)) : null

  // Heartbeat so others can see who is in the room right now.
  useEffect(() => {
    if (!me || me.status !== 'here') return
    const beat = () => db.upsertMember({ ...me, lastSeen: Date.now() })
    const t = setInterval(beat, 45_000)
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
      await db.upsertMember({ id: meId, roomId, name: name.trim(), character, status: 'here', lastSeen: Date.now() })
      if (room && (!room.hostId || !members.some((m) => m.id === room.hostId))) await patchRoom({ hostId: meId })
    },
    async setStatus(status: Member['status']) {
      if (!me) return
      await db.upsertMember({ ...me, status, lastSeen: Date.now() })
      if (status === 'here' && room && !members.some((m) => m.id === room.hostId && m.status === 'here')) await patchRoom({ hostId: meId })
    },
    async updateMe(p: Partial<Pick<Member, 'name' | 'character'>>) { if (me) await db.upsertMember({ ...me, ...p }) },
    async leave() { await db.removeMember(meId); forgetMe(roomId); location.reload() },
    async makeHost(memberId: string) { await patchRoom({ hostId: memberId }) },
    async claimHost() { await patchRoom({ hostId: meId }) },

    async vote(value: CardValue) {
      if (!current || !room || room.revealed || current.points || current.skipped) return // pointed/skipped stories are locked
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
    async skipStory(note: string) {
      if (!current || !room) return
      await db.upsertStories([{ ...current, skipped: true, note: note.trim() }])
      await goToNextOpen(current)
    },
    /** Bring a skipped story back into this sprint's voting. */
    async unskipStory() {
      if (!current) return
      await db.upsertStories([{ ...current, skipped: false }])
    },
    async selectStory(id: string) {
      const s = stories.find((x) => x.id === id)
      // A pointed story opens locked (showing its points); the host can revote it on purpose.
      if (s) await patchRoom({ currentStoryId: id, revealed: false, round: s.rounds })
    },
    /** Reopen voting on a story that already has points. */
    async revoteStory() {
      if (!current || !room) return
      const round = current.rounds + 1
      await db.upsertStories([{ ...current, points: null, outcome: null, rounds: round }])
      await patchRoom({ revealed: false, round })
    },
    /** Add stories to the backlog (default) or straight into this session. */
    async addStories(rows: ParsedStory[], pattern = room?.adoPattern ?? '', to: 'backlog' | 'session' = 'session') {
      if (!activeSprint || !room) return
      const list = to === 'backlog' ? backlog : lineup
      if (to === 'backlog' && !snap.sprints.some((s) => s.id === backlogId))
        await db.upsertSprint({ id: backlogId, roomId, name: 'Backlog', title: '', startedAt: 0, closedAt: null })
      const base = list.length ? Math.max(...list.map((s) => s.order)) + 1 : 0
      const created: Story[] = rows.map((r, i) => ({
        id: uid(), roomId, sprintId: to === 'backlog' ? backlogId : activeSprint.id, number: r.number, title: r.title,
        url: r.url?.trim() || buildAdoUrl(pattern, r.number), points: null, outcome: null, rounds: 1, order: base + i,
      }))
      await db.upsertStories(created)
      if (to === 'session' && (!room.currentStoryId || !stories.some((s) => s.id === room.currentStoryId && s.sprintId === activeSprint.id)))
        await patchRoom({ currentStoryId: created[0]?.id ?? null, revealed: false, round: 1 })
    },
    /** Pick backlog stories for this session (in the order given). */
    async moveToSession(ids: string[]) {
      if (!activeSprint || !room || !ids.length) return
      const base = lineup.length ? Math.max(...lineup.map((s) => s.order)) + 1 : 0
      const picked = ids.map((id) => stories.find((s) => s.id === id)).filter(Boolean) as Story[]
      await db.upsertStories(picked.map((s, i) => ({ ...s, sprintId: activeSprint.id, order: base + i, skipped: false })))
      if (!current) await patchRoom({ currentStoryId: picked[0].id, revealed: false, round: picked[0].rounds })
    },
    /** Put a story from this session back in the backlog. */
    async moveToBacklog(id: string) {
      const s = stories.find((x) => x.id === id)
      if (!s || !room) return
      if (!snap.sprints.some((x) => x.id === backlogId))
        await db.upsertSprint({ id: backlogId, roomId, name: 'Backlog', title: '', startedAt: 0, closedAt: null })
      const base = backlog.length ? Math.min(...backlog.map((x) => x.order)) - 1 : 0 // goes to the top of the backlog
      await db.upsertStories([{ ...s, sprintId: backlogId, order: base, points: null, outcome: null, skipped: false }])
      if (room.currentStoryId === id) await goToNextOpen(s)
    },
    /** Save a new top-to-bottom order for a list (backlog or session). Only stories whose place changed are written. */
    async reorder(ids: string[]) {
      const changed = reorderRows(stories, ids)
      if (!changed.length) return
      setSnap((p) => ({ ...p, stories: p.stories.map((s) => changed.find((c) => c.id === s.id) ?? s) })) // no snap-back while saving
      await db.upsertStories(changed)
    },
    async setNextCount(n: number) { await patchRoom({ nextCount: Math.max(1, Math.min(30, Math.round(n))) }) },
    async editStory(s: Story) { await db.upsertStories([s]) },
    async removeStory(id: string) {
      await db.removeStory(id)
      if (room?.currentStoryId === id) await patchRoom({ currentStoryId: lineup.find((s) => s.id !== id)?.id ?? null, revealed: false, round: 1 })
    },
    async setAdoPattern(adoPattern: string) {
      await patchRoom({ adoPattern })
      const missing = stories.filter((s) => !s.url)
      if (missing.length) await db.upsertStories(missing.map((s) => ({ ...s, url: buildAdoUrl(adoPattern, s.number) })))
    },
    async renameSprint(p: Partial<Pick<Sprint, 'name' | 'title'>>) { if (activeSprint) await db.upsertSprint({ ...activeSprint, ...p }) },
    async closeAndStartNext(name: string, title: string) {
      if (!room) return
      if (activeSprint) await db.upsertSprint({ ...activeSprint, closedAt: Date.now() })
      const next: Sprint = { id: uid(), roomId, name, title, startedAt: Date.now(), closedAt: null }
      await db.upsertSprint(next)
      // Stories that weren't pointed go back to the top of the backlog (with their notes). The finished session
      // keeps a copy marked as skipped, so its history stays accurate.
      const carry = lineup.filter((s) => !s.points)
      if (carry.length) {
        if (!snap.sprints.some((x) => x.id === backlogId))
          await db.upsertSprint({ id: backlogId, roomId, name: 'Backlog', title: '', startedAt: 0, closedAt: null })
        const top = backlog.length ? Math.min(...backlog.map((x) => x.order)) - carry.length : 0
        await db.upsertStories(carry.map((s) => ({ ...s, skipped: true })))
        await db.upsertStories(carry.map((s, i) => ({
          ...s, id: uid(), sprintId: backlogId, points: null, outcome: null, rounds: 1, order: top + i, skipped: false,
          note: s.note ? `Not pointed last session: ${s.note.replace(/^(Carried from[^:]*|Not pointed last session): /, '')}` : 'Not pointed last session',
        })))
      }
      await patchRoom({ activeSprintId: next.id, currentStoryId: null, revealed: false, round: 1 })
    },
  }

  return { ready, error, mode: db.mode, meId, me, room, members, sprints, stories, votes, activeSprint, lineup, backlog, current, roundVotes, myVote, isHost, result, actions }
}
export type RoomApi = ReturnType<typeof useRoom>
