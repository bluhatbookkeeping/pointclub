// Point Club room API. Pure logic over a `Query` function so it runs on Neon in
// production and on an in-memory Postgres in tests.
export type Query = (text: string, params?: unknown[]) => Promise<Record<string, any>[]>
export interface Reply { status: number; body: unknown }

type Col = { name: string; type: 'text' | 'int' | 'bigint' | 'bool' }
const t = (name: string): Col => ({ name, type: 'text' })
const i = (name: string): Col => ({ name, type: 'int' })
const b = (name: string): Col => ({ name, type: 'bigint' })
const TABLES = {
  rooms: [t('id'), t('name'), t('host_id'), t('active_sprint_id'), t('current_story_id'), { name: 'revealed', type: 'bool' }, i('round'), t('ado_pattern')],
  members: [t('id'), t('room_id'), t('name'), t('character'), t('status'), b('last_seen')],
  sprints: [t('id'), t('room_id'), t('name'), t('title'), b('started_at'), b('closed_at')],
  stories: [t('id'), t('room_id'), t('sprint_id'), t('number'), t('title'), t('url'), t('points'), t('outcome'), i('rounds'), i('order')],
  votes: [t('id'), t('room_id'), t('story_id'), t('member_id'), i('round'), t('value')],
} satisfies Record<string, Col[]>
type Table = keyof typeof TABLES

const OPS: Record<string, { table: Table; kind: 'upsert' | 'upsertMany' | 'delete' }> = {
  upsertRoom: { table: 'rooms', kind: 'upsert' },
  upsertMember: { table: 'members', kind: 'upsert' },
  removeMember: { table: 'members', kind: 'delete' },
  upsertSprint: { table: 'sprints', kind: 'upsert' },
  upsertStories: { table: 'stories', kind: 'upsertMany' },
  removeStory: { table: 'stories', kind: 'delete' },
  upsertVote: { table: 'votes', kind: 'upsert' },
  removeVote: { table: 'votes', kind: 'delete' },
}

const ID = /^[A-Za-z0-9_:.-]{1,120}$/
const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
const q = (n: string) => `"${n}"`

class BadRequest extends Error {}
function clean(col: Col, v: unknown): unknown {
  if (v === undefined || v === null) return null
  switch (col.type) {
    case 'text': if (typeof v !== 'string' || v.length > 2000) throw new BadRequest(`bad ${col.name}`); return v
    case 'int': case 'bigint': if (typeof v !== 'number' || !Number.isFinite(v)) throw new BadRequest(`bad ${col.name}`); return Math.trunc(v)
    case 'bool': if (typeof v !== 'boolean') throw new BadRequest(`bad ${col.name}`); return v
  }
}
/** Map a camelCase row from the browser to [columns, values], forcing it into this room. */
function toRow(table: Table, roomId: string, data: any): [string[], unknown[]] {
  if (!data || typeof data !== 'object') throw new BadRequest('missing data')
  const row: Record<string, unknown> = { ...data }
  if (table === 'rooms') row.id = roomId; else row.roomId = roomId
  if (typeof row.id !== 'string' || !ID.test(row.id)) throw new BadRequest('bad id')
  const cols: string[] = [], vals: unknown[] = []
  for (const col of TABLES[table]) {
    const key = camel(col.name)
    if (key in row) { cols.push(col.name); vals.push(clean(col, row[key])) }
  }
  return [cols, vals]
}
function fromRow(table: Table | 'events', r: Record<string, any>) {
  const out: Record<string, any> = {}
  const cols = table === 'events' ? [] : TABLES[table]
  for (const [k, v] of Object.entries(r)) {
    const col = cols.find((c) => c.name === k)
    out[camel(k)] = col && (col.type === 'bigint' || col.type === 'int') && v !== null ? Number(v) : v
  }
  return out
}

async function upsert(db: Query, table: Table, cols: string[], vals: unknown[]) {
  const ph = vals.map((_, n) => `$${n + 1}`).join(',')
  const set = cols.filter((c) => c !== 'id').map((c) => `${q(c)} = excluded.${q(c)}`).join(', ')
  await db(`insert into ${table} (${cols.map(q).join(',')}) values (${ph}) on conflict (id) do ${set ? 'update set ' + set : 'nothing'}`, vals)
}
const bump = (db: Query, roomId: string) => db('update rooms set version = version + 1 where id = $1', [roomId])

export async function handle(db: Query, method: string, query: Record<string, any>, body: any): Promise<Reply> {
  try {
    const roomId = String(query.id ?? '')
    if (!ID.test(roomId)) return { status: 400, body: { error: 'bad room id' } }

    if (method === 'GET') {
      const v = Number(query.v ?? -1), e = Number(query.e ?? -1)
      const [room] = await db('select * from rooms where id = $1', [roomId])
      let events: unknown[] = [], lastEvent = e
      if (e < 0) {
        const [m] = await db('select coalesce(max(id), 0) as m from events where room_id = $1', [roomId]); lastEvent = Number(m?.m ?? 0)
      } else {
        const rows = await db('select id, payload from events where room_id = $1 and id > $2 order by id limit 100', [roomId, e])
        events = rows.map((r) => r.payload); if (rows.length) lastEvent = Number(rows[rows.length - 1].id)
      }
      const version = room ? Number(room.version) : 0
      if (room && version === v) return { status: 200, body: { unchanged: true, version, events, lastEvent } }
      const [members, sprints, stories, votes] = await Promise.all((['members', 'sprints', 'stories', 'votes'] as Table[]).map((tb) => db(`select * from ${tb} where room_id = $1`, [roomId])))
      const snap = {
        room: room ? (({ version: _v, ...r }) => r)(fromRow('rooms', room)) : null,
        members: members.map((r) => fromRow('members', r)), sprints: sprints.map((r) => fromRow('sprints', r)),
        stories: stories.map((r) => fromRow('stories', r)), votes: votes.map((r) => fromRow('votes', r)),
      }
      return { status: 200, body: { unchanged: false, version, snapshot: snap, events, lastEvent } }
    }

    if (method === 'POST') {
      const op = body?.op as string
      if (op === 'event') {
        const payload = body?.data
        if (!payload || typeof payload !== 'object' || JSON.stringify(payload).length > 2000) throw new BadRequest('bad event')
        await db('insert into events (room_id, payload) values ($1, $2)', [roomId, JSON.stringify(payload)])
        await db("delete from events where room_id = $1 and created_at < now() - interval '2 minutes'", [roomId])
        return { status: 200, body: { ok: true } }
      }
      if (op === 'ensureRoom') {
        // First visitor creates the room and its first sprint; anyone arriving at the same moment changes nothing.
        const [rc, rv] = toRow('rooms', roomId, body?.data?.room)
        const created = await db(`insert into rooms (${rc.map(q).join(',')}) values (${rv.map((_, n) => `$${n + 1}`).join(',')}) on conflict (id) do nothing returning id`, rv)
        if (created.length) {
          const [sc, sv] = toRow('sprints', roomId, body?.data?.sprint)
          await upsert(db, 'sprints', sc, sv)
        }
        return { status: 200, body: { ok: true, created: created.length > 0 } }
      }
      if (op === 'patchRoom') {
        const data = body?.data
        if (!data || typeof data !== 'object') throw new BadRequest('missing data')
        const cols: string[] = [], vals: unknown[] = []
        for (const col of TABLES.rooms) {
          if (col.name === 'id') continue
          const key = camel(col.name)
          if (key in data) { cols.push(col.name); vals.push(clean(col, data[key])) }
        }
        if (!cols.length) throw new BadRequest('nothing to update')
        const set = cols.map((c, n) => `${q(c)} = $${n + 2}`).join(', ')
        const r = await db(`update rooms set ${set}, version = version + 1 where id = $1 returning id`, [roomId, ...vals])
        if (!r.length) throw new BadRequest('room does not exist')
        return { status: 200, body: { ok: true } }
      }
      const spec = OPS[op]
      if (!spec) throw new BadRequest('unknown op')
      if (spec.table !== 'rooms') {
        const [exists] = await db('select 1 from rooms where id = $1', [roomId])
        if (!exists) throw new BadRequest('room does not exist')
      }
      if (spec.kind === 'delete') {
        const id = body?.data?.id
        if (typeof id !== 'string' || !ID.test(id)) throw new BadRequest('bad id')
        await db(`delete from ${spec.table} where id = $1 and room_id = $2`, [id, roomId])
      } else {
        const rows = spec.kind === 'upsertMany' ? body?.data : [body?.data]
        if (!Array.isArray(rows) || rows.length > 300) throw new BadRequest('bad rows')
        for (const r of rows) { const [cols, vals] = toRow(spec.table, roomId, r); await upsert(db, spec.table, cols, vals) }
      }
      await bump(db, roomId)
      return { status: 200, body: { ok: true } }
    }
    return { status: 405, body: { error: 'method not allowed' } }
  } catch (err: any) {
    if (err instanceof BadRequest) return { status: 400, body: { error: err.message } }
    // Foreign-key/check violations from bad input are client errors too.
    if (err?.code && String(err.code).startsWith('23')) return { status: 400, body: { error: 'constraint violation' } }
    console.error(err)
    return { status: 500, body: { error: 'server error' } }
  }
}
