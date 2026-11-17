import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import fs from 'node:fs'

/** `npm run dev:api`: serves /api/room locally on an in-memory Postgres, so team mode can be tested without Vercel. */
function localApi(): Plugin {
  return {
    name: 'pointclub-local-api',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.VITE_BACKEND !== 'api') return
      const { PGlite } = await import('@electric-sql/pglite')
      const pg = new PGlite()
      await pg.exec(fs.readFileSync(path.resolve(__dirname, 'db/schema.sql'), 'utf8'))
      const db = async (text: string, params: unknown[] = []) => (await pg.query(text, params as any[])).rows as any[]
      server.middlewares.use('/api/room', async (req, res) => {
        const { handle } = await server.ssrLoadModule('/api/_core.ts')
        const url = new URL(req.url ?? '', 'http://x')
        let raw = ''; for await (const c of req) raw += c
        const r = await handle(db, req.method, Object.fromEntries(url.searchParams), raw ? JSON.parse(raw) : null)
        res.statusCode = r.status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(r.body))
      })
    },
  }
}

export default defineConfig({ plugins: [react(), localApi()], resolve: { alias: { '@': path.resolve(__dirname, 'src') } } })
