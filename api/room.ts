import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { handle, type Query } from './_core.js'

// Vercel's Neon connection may add a custom prefix (e.g. STORAGE_DATABASE_URL), so accept any of these names.
const envKey = ['DATABASE_URL', 'POSTGRES_URL'].find((k) => process.env[k])
  ?? Object.keys(process.env).find((k) => /(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(k) && process.env[k])
const url = envKey ? process.env[envKey] : undefined
const sql = url ? neon(url) : null
const db: Query = (text, params = []) => (sql as any)(text, params)

// Create the tables on first use, so no manual database setup is needed.
let ready: Promise<void> | null = null
function ensureSchema() {
  ready ??= (async () => {
    const schema = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8')
    for (const stmt of schema.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean)) await db(stmt)
  })().catch((e) => { ready = null; throw e })
  return ready
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store')
  if (!sql) return res.status(500).json({ error: 'DATABASE_URL is not set. In Vercel, connect the Neon database to this project (Storage tab) for Production, then redeploy.' })
  try { await ensureSchema() } catch (e) { console.error(e); return res.status(500).json({ error: 'database setup failed' }) }
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
  const r = await handle(db, req.method, req.query ?? {}, body)
  res.status(r.status).json(r.body)
}
