import { describe, expect, it } from 'vitest'
import { judge } from './consensus'
import { parseStories, buildAdoUrl } from './parseStories'

describe('judge', () => {
  it('all the same is a blockbuster, ignoring ? and coffee', () => {
    const r = judge(['5', '5', '?', 'coffee', '5'])
    expect(r.outcome).toBe('blockbuster'); expect(r.suggested).toBe('5')
  })
  it('neighbouring cards are critics choice; ties pick the bigger card', () => {
    const r = judge(['3', '5', '3', '5'])
    expect(r.outcome).toBe('critics'); expect(r.suggested).toBe('5'); expect(r.average).toBe(4)
  })
  it('two or more steps apart is a plot twist', () => {
    const r = judge(['2', '8', '3'])
    expect(r.outcome).toBe('plottwist'); expect(r.low).toBe('2'); expect(r.high).toBe('8')
  })
  it('no numeric votes', () => expect(judge(['?', 'coffee']).outcome).toBe('none'))
})

describe('parseStories', () => {
  it('reads common ADO board line shapes', () => {
    const text = `Backlog
User Story 48213: Export invoices to CSV
#48214 Add vendor search | 5
48215 - Fix login timeout
48216
Dark mode for reports
New  Active`
    expect(parseStories(text)).toEqual([
      { number: '48213', title: 'Export invoices to CSV' },
      { number: '48214', title: 'Add vendor search' },
      { number: '48215', title: 'Fix login timeout' },
      { number: '48216', title: 'Dark mode for reports' },
    ])
  })
  it('skips duplicates and short noise', () => expect(parseStories('1234 ok\n1234 Again title\n555 ab')).toEqual([{ number: '1234', title: 'Again title' }]))
  it('builds links', () => expect(buildAdoUrl('https://x/_workitems/edit/{id}', '42')).toBe('https://x/_workitems/edit/42'))
})
