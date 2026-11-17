export interface ParsedStory { number: string; title: string; url?: string }

const URL_RE = /(https?:\/\/\S+)/i
const PREFIX_RE = /^.*?\b(?:user story|story|bug|task|pbi|feature|work item)\b[\s:#.-]*(?=#?[0-9OoIlS]{3,8}\b)/i
const SHORT_OK = /^(a|ai|ui|qa|it|po|ux|ad|id|ok|v\d|\d)$/i // short words a title may really start with

/** A token that is (almost) all digits, with common OCR slips fixed: O→0, l/I→1, S→5. */
function asNumber(tok: string | undefined): string | null {
  if (!tok) return null
  const t = tok.replace(/^#/, '').replace(/[.,:;)\]]+$/, '')
  if (!/^[0-9OoIlS]{3,8}$/.test(t) || (t.match(/\d/g)?.length ?? 0) < 3) return null
  return t.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/S/g, '5')
}

/** Drop icon/table junk OCR leaves in front of a title (e.g. "©", "|", "B"), keep real words. */
function cleanTitle(title: string): string {
  let t = title.replace(/^[\s:.\-–—|)\]]+/, '')
  for (let i = 0; i < 2; i++) {
    const m = t.match(/^(\S+)\s+(.*)$/)
    if (!m) break
    const [, first, rest] = m
    const junk = /^[^A-Za-z0-9]+$/.test(first) || (first.length <= 2 && !SHORT_OK.test(first) && /^[A-Z0-9]/.test(rest))
    if (!junk) break
    t = rest
  }
  return t
    .replace(/\s*\|\s*\d+(\.\d+)?\s*(pts?|points?)?\s*$/i, '') // trailing "| 5" effort column
    .replace(/\s+\d+(\.\d+)?\s*(pts?|points?)$/i, '') // trailing "5 pts"
    .replace(/[\s|]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Turn OCR text (or pasted text) into "story number + title" rows.
 * Handles ADO backlog screenshots where each line is "<row #> <work item ID> <title>": the short row number is
 * ignored and the long work item ID becomes the story number. A link on the same line becomes the story's link.
 */
export function parseStories(text: string): ParsedStory[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[•●○◆■□]/g, ' ').replace(/^[\s|]+|[\s|]+$/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const out: ParsedStory[] = []
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    const url = line.match(URL_RE)?.[1]
    if (url) line = line.replace(url, ' ').replace(/\s+/g, ' ').trim()
    // A bare story link with no number in front: take the number from the link itself.
    if (!line && url) { const n = url.match(/(\d{3,8})(?!.*\d{3,8})/)?.[1]; if (n) line = n }
    line = line.replace(PREFIX_RE, '')

    const m = line.match(/^#?(\S+)\s*(.*)$/)
    if (!m) continue
    const rowNum = /^\d{1,4}$/.test(m[1]) // a short leading number may just be the row number
    let number = asNumber(m[1])
    let rest = m[2] ?? ''
    // "<row #> <work item ID> …": a short row number followed by a long ID → use the ID.
    const m2 = rest.match(/^[:.\-–—|)\]]*\s*#?(\S+)\s*(.*)$/)
    const second = asNumber(m2?.[1])
    if (second && second.length >= 5 && rowNum) { number = second; rest = m2![2] ?? '' }
    if (!number) continue

    let title = cleanTitle(rest)
    // Number alone on a line: the title is usually the next line.
    if (!title && lines[i + 1] && !asNumber(lines[i + 1].split(' ')[0]) && !URL_RE.test(lines[i + 1])) { title = cleanTitle(lines[i + 1]); i++ }
    if (!title || title.length < 3 || seen.has(number)) continue
    seen.add(number)
    out.push(url ? { number, title, url } : { number, title })
  }
  return out
}

export const buildAdoUrl = (pattern: string, number: string) => (pattern && pattern.includes('{id}') ? pattern.replace('{id}', number) : '')

/**
 * Accept either a template with {id} or a real story link copied from ADO, e.g.
 * https://dev.azure.com/org/proj/_workitems/edit/48213 → https://dev.azure.com/org/proj/_workitems/edit/{id}
 */
export function toAdoPattern(input: string): string {
  const s = input.trim()
  if (!s || s.includes('{id}')) return s
  const m = s.match(/^(.*?)(\d{3,8})(\D*)$/) // last run of digits is the work item id
  return m ? `${m[1]}{id}${m[3]}` : s
}
