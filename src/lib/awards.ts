import { NUMERIC, Member, Sprint, Story, Vote } from './types'

export function sprintStats(sprint: Sprint, stories: Story[], votes: Vote[], members: Member[]) {
  const list = stories.filter((s) => s.sprintId === sprint.id).sort((a, b) => a.order - b.order)
  const pointed = list.filter((s) => s.points)
  const total = pointed.reduce((s, x) => s + (Number(x.points) || 0), 0)
  const finalVotes = (s: Story) => votes.filter((v) => v.storyId === s.id && v.round === s.rounds)
  const per: Record<string, { name: string; dist: number; n: number; coffee: number; hits: number }> = {}
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? 'Former member'
  for (const s of pointed) {
    const fi = NUMERIC.indexOf(s.points as any)
    for (const v of finalVotes(s)) {
      const p = (per[v.memberId] ??= { name: name(v.memberId), dist: 0, n: 0, coffee: 0, hits: 0 })
      if (v.value === 'coffee') { p.coffee++; continue }
      const vi = NUMERIC.indexOf(v.value)
      if (vi < 0 || fi < 0) continue
      p.dist += Math.abs(vi - fi); p.n++; if (vi === fi) p.hits++
    }
  }
  const people = Object.values(per)
  const top = <K extends keyof (typeof people)[number]>(k: K, f = (p: (typeof people)[number]) => p[k] as number) =>
    people.filter((p) => f(p) > 0).sort((a, b) => f(b) - f(a))[0]
  return {
    list, pointed, total,
    blockbusters: pointed.filter((s) => s.outcome === 'blockbuster').length,
    twists: pointed.filter((s) => s.outcome === 'plottwist').length,
    retakes: pointed.reduce((s, x) => s + (x.rounds - 1), 0),
    contrarian: top('dist', (p) => (p.n ? p.dist / p.n : 0)),
    sharpshooter: top('hits'),
    coffee: top('coffee'),
    finalVotes,
  }
}
