import { describe, expect, it } from 'vitest'
import { judge } from './consensus'
import { parseStories, buildAdoUrl, toAdoPattern } from './parseStories'
import { reorderRows } from './useRoom'

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
  it('builds no link from a pattern without {id}', () => expect(buildAdoUrl('https://x/_workitems/edit/48213', '42')).toBe(''))
  it('reads ADO backlog rows: ignores the row number, uses the work item ID', () => {
    const ocr = `3         647760  RHRP Portal API | Move to Windows Server 2025 (UAT)

10        655599  Examinee Portal | Show Up to Three Phone Numbers for Text and Voice Opt-In/Opt-Out
37       650397 Examinee Portal | Fix 508 Findings in Notification Preferences (Opt-In/Opt-Out), Phase 2 Development
62       648329  Bug ExamTrak | Need Help Signing in? link does not open the Need Help page
63        648330  Bug: ExamTrak | Need Help link on the Exam Track login page does nothing
72        655805  Provider Portal: Add 2026 tax forms from Avalara
84         655906  © Examinee Portal | Hide appointments in error (DBQ #300) from My Appointments
85  6559O7  B NGV2Services | Add unit tests`
    expect(parseStories(ocr)).toEqual([
      { number: '647760', title: 'RHRP Portal API | Move to Windows Server 2025 (UAT)' },
      { number: '655599', title: 'Examinee Portal | Show Up to Three Phone Numbers for Text and Voice Opt-In/Opt-Out' },
      { number: '650397', title: 'Examinee Portal | Fix 508 Findings in Notification Preferences (Opt-In/Opt-Out), Phase 2 Development' },
      { number: '648329', title: 'Bug ExamTrak | Need Help Signing in? link does not open the Need Help page' },
      { number: '648330', title: 'Bug: ExamTrak | Need Help link on the Exam Track login page does nothing' },
      { number: '655805', title: 'Provider Portal: Add 2026 tax forms from Avalara' },
      { number: '655906', title: 'Examinee Portal | Hide appointments in error (DBQ #300) from My Appointments' },
      { number: '655907', title: 'NGV2Services | Add unit tests' },
    ])
  })
  it('keeps a number that starts the title', () =>
    expect(parseStories('48213 2026 tax forms')).toEqual([{ number: '48213', title: '2026 tax forms' }]))
  it('keeps a " | " inside a title', () =>
    expect(parseStories('344554 Examinee Portal | Hide past appointments')).toEqual([{ number: '344554', title: 'Examinee Portal | Hide past appointments' }]))
  it('captures a link written on the same line', () =>
    expect(parseStories('48214 Add vendor search https://dev.azure.com/o/p/_workitems/edit/48214')).toEqual([
      { number: '48214', title: 'Add vendor search', url: 'https://dev.azure.com/o/p/_workitems/edit/48214' },
    ]))
})

describe('toAdoPattern', () => {
  it('turns a real story link into a template', () => {
    expect(toAdoPattern('https://dev.azure.com/org/proj/_workitems/edit/48213')).toBe('https://dev.azure.com/org/proj/_workitems/edit/{id}')
    expect(toAdoPattern('https://dev.azure.com/org/proj/_workitems/edit/48213/')).toBe('https://dev.azure.com/org/proj/_workitems/edit/{id}/')
    expect(toAdoPattern('https://org.visualstudio.com/proj/_boards/board?workitem=344554')).toBe('https://org.visualstudio.com/proj/_boards/board?workitem={id}')
  })
  it('leaves templates and blanks alone', () => {
    expect(toAdoPattern('https://x/edit/{id}')).toBe('https://x/edit/{id}')
    expect(toAdoPattern('  ')).toBe('')
  })
})

describe('reorderRows', () => {
  const mk = (id: string, order: number) => ({ id, order } as any)
  it('renumbers in the new order and returns only rows that moved', () => {
    const rows = [mk('a', 0), mk('b', 1), mk('c', 2), mk('d', 3)]
    const out = reorderRows(rows, ['c', 'a', 'b', 'd'])
    expect(out.map((r) => [r.id, r.order])).toEqual([['c', 0], ['a', 1], ['b', 2]])
  })
  it('writes nothing when the order is unchanged', () => expect(reorderRows([mk('a', 0), mk('b', 1)], ['a', 'b'])).toEqual([]))
})
