import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { handle, type Query } from '../api/_core'

let db: Query
beforeEach(async () => {
  const pg = new PGlite()
  await pg.exec(readFileSync('db/schema.sql', 'utf8'))
  db = async (text, params = []) => (await pg.query(text, params as any[])).rows as any[]
})
const post = (op: string, data: unknown, id = 'room1') => handle(db, 'POST', { id }, { op, data })
const get = (v = -1, e = -1, id = 'room1') => handle(db, 'GET', { id, v, e }, null) as Promise<{ status: number; body: any }>

describe('room api', () => {
  it('creates a room and returns a snapshot, then reports unchanged', async () => {
    expect((await post('upsertRoom', { id: 'ignored', name: 'Point Club', hostId: null, activeSprintId: 's1', currentStoryId: null, revealed: false, round: 1, adoPattern: '' })).status).toBe(200)
    await post('upsertSprint', { id: 's1', name: 'Sprint 1', title: 'The Pilot', startedAt: 1700000000000, closedAt: null })
    const a = await get()
    expect(a.body.snapshot.room.id).toBe('room1') // id is forced to the URL's room
    expect(a.body.snapshot.sprints[0]).toMatchObject({ id: 's1', roomId: 'room1', startedAt: 1700000000000, closedAt: null })
    const b = await get(a.body.version, a.body.lastEvent)
    expect(b.body.unchanged).toBe(true)
  })

  it('full voting flow: members, stories, votes, removals bump the version', async () => {
    await post('upsertRoom', { name: 'x', revealed: false, round: 1, adoPattern: '' })
    await post('upsertSprint', { id: 's1', name: 'Sprint 1', title: '', startedAt: 1 })
    await post('upsertMember', { id: 'm1', name: 'Maria', character: 'fixer', status: 'here', lastSeen: 5 })
    await post('upsertStories', [{ id: 'st1', sprintId: 's1', number: '48213', title: 'Export', url: '', points: null, outcome: null, rounds: 1, order: 0 }])
    await post('upsertVote', { id: 'st1:1:m1', storyId: 'st1', memberId: 'm1', round: 1, value: '5' })
    let s = (await get()).body
    expect(s.snapshot.votes).toHaveLength(1)
    expect(s.snapshot.stories[0].order).toBe(0)
    const v = s.version
    await post('removeVote', { id: 'st1:1:m1' })
    s = (await get(v)).body
    expect(s.unchanged).toBe(false)
    expect(s.snapshot.votes).toHaveLength(0)
  })

  it('rejects unknown ops, bad types, bad ids and writes to rooms that do not exist', async () => {
    expect((await post('dropTables', {})).status).toBe(400)
    expect((await post('upsertMember', { id: 'm1', name: 'x', character: 'y', status: 'here', lastSeen: 1 })).status).toBe(400) // no room yet
    await post('upsertRoom', { name: 'x' })
    expect((await post('upsertMember', { id: 'm1', name: 42, character: 'y' })).status).toBe(400)
    expect((await post('upsertMember', { id: "x'; drop table rooms;--", name: 'a', character: 'y' })).status).toBe(400)
    expect((await post('upsertMember', { id: 'm2', name: 'a', character: 'y', status: 'gone' })).status).toBe(400) // check constraint
    expect((await handle(db, 'GET', { id: '../etc' }, null)).status).toBe(400)
  })

  it('cannot touch another room\'s rows', async () => {
    await post('upsertRoom', { name: 'a' }, 'roomA'); await post('upsertRoom', { name: 'b' }, 'roomB')
    await post('upsertMember', { id: 'm1', name: 'A', character: 'fixer' }, 'roomA')
    await post('removeMember', { id: 'm1' }, 'roomB')
    expect((await get(-1, -1, 'roomA')).body.snapshot.members).toHaveLength(1)
  })

  it('patchRoom changes only the fields sent (no stale overwrite)', async () => {
    await post('upsertRoom', { name: 'x', hostId: 'm1', adoPattern: '', revealed: false, round: 1 })
    await post('patchRoom', { adoPattern: 'https://ado/edit/{id}' })
    await post('patchRoom', { currentStoryId: 'st1', revealed: false, round: 1 }) // the second save that used to wipe the link
    const room = (await get()).body.snapshot.room
    expect(room).toMatchObject({ adoPattern: 'https://ado/edit/{id}', currentStoryId: 'st1', hostId: 'm1' })
    expect((await post('patchRoom', { version: 99 })).status).toBe(400) // not an allowed field
    expect((await post('patchRoom', { name: 'y' }, 'nope')).status).toBe(400) // room must exist
  })

  it('ensureRoom creates the room and first sprint once, even if several people arrive together', async () => {
    const mk = (n: string) => ({ room: { name: 'x', activeSprintId: 's-' + n, revealed: false, round: 1, adoPattern: '' }, sprint: { id: 's-' + n, name: 'Sprint 1', title: '', startedAt: 1 } })
    await Promise.all([post('ensureRoom', mk('a')), post('ensureRoom', mk('b')), post('ensureRoom', mk('c'))])
    const snap = (await get()).body.snapshot
    expect(snap.sprints).toHaveLength(1)
    expect(snap.room.activeSprintId).toBe(snap.sprints[0].id)
  })

  it('saves skipped stories with their note', async () => {
    await post('upsertRoom', { name: 'x' }); await post('upsertSprint', { id: 's1', name: 'Sprint 1', title: '', startedAt: 1 })
    await post('upsertStories', [{ id: 'st1', sprintId: 's1', number: '1', title: 'Needs info', url: '', points: null, outcome: null, rounds: 1, order: 0, skipped: true, note: 'Waiting on API spec' }])
    expect((await get()).body.snapshot.stories[0]).toMatchObject({ skipped: true, note: 'Waiting on API spec' })
  })

  it('delivers live events after the cursor only', async () => {
    await post('upsertRoom', { name: 'x' })
    const first = (await get()).body
    await post('event', { kind: 'throw', from: 'a', to: 'b', item: '🍅' })
    const next = (await get(first.version, first.lastEvent)).body
    expect(next.events).toEqual([{ kind: 'throw', from: 'a', to: 'b', item: '🍅' }])
    expect((await get(next.version, next.lastEvent)).body.events).toEqual([])
  })
})
