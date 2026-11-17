import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { makeBackend, setLocalEcho } from './backend'
import { judge } from './consensus'
import { getMyId, forgetMe, uid } from './identity'
import { buildAdoUrl, ParsedStory } from './parseStories'
import type { CardValue, LiveEvent, Member, Room, Snapshot, Sprint, Story } from './types'

const EMPTY: Snapshot = { room: null, members: [], sprints: [], stories: [], votes: [] }

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
          const sprint: Sprint = { id: uid(), roomId, name: 'Sprint 1', title: 'The Pilot', startedAt: Date.now(), closedAt: null }
          const room: Room = { id: roomId, name: 'Point Club', hostId: null, activeSprintId: sprint.id, currentStoryId: null, revealed: false, round: 1, adoPattern: '' }
          await db.ensureRoom(room, sprint)
        }
        await refresh()
      } catch (e: any) { setError(e?.message ?? String(e)) }
      setReady(true)
    })()
    return off
  }, [db, roomId, refresh])

  const { room, members, sprints, stories, votes } = snap
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
      if (!current || !room || room.revealed) return
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
      await db.upsertStories([{ ...current, points, outcome, rounds: room.round }])
      const next = lineup.find((s) => s.id !== current.id && s.points == null && s.order > current.order) ?? lineup.find((s) => s.id !== current.id && s.points == null)
      await patchRoom({ currentStoryId: next?.id ?? current.id, revealed: false, round: next ? next.rounds : room.round })
    },
    async selectStory(id: string) {
      const s = stories.find((x) => x.id === id)
      if (s) await patchRoom({ currentStoryId: id, revealed: false, round: s.points ? s.rounds + 1 : s.rounds })
    },
    async addStories(rows: ParsedStory[], pattern = room?.adoPattern ?? '') {
      if (!activeSprint || !room) return
      const base = lineup.length ? Math.max(...lineup.map((s) => s.order)) + 1 : 0
      const created: Story[] = rows.map((r, i) => ({
        id: uid(), roomId, sprintId: activeSprint.id, number: r.number, title: r.title,
        url: r.url?.trim() || buildAdoUrl(pattern, r.number), points: null, outcome: null, rounds: 1, order: base + i,
      }))
      await db.upsertStories(created)
      if (!room.currentStoryId || !stories.some((s) => s.id === room.currentStoryId && s.sprintId === activeSprint.id))
        await patchRoom({ currentStoryId: created[0]?.id ?? null, revealed: false, round: 1 })
    },
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
      await patchRoom({ activeSprintId: next.id, currentStoryId: null, revealed: false, round: 1 })
    },
  }

  return { ready, error, mode: db.mode, meId, me, room, members, sprints, stories, votes, activeSprint, lineup, current, roundVotes, myVote, isHost, result, actions }
}
export type RoomApi = ReturnType<typeof useRoom>
