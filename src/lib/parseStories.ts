export interface ParsedStory { number: string; title: string; url?: string }

const NUM_LINE = /^(?:.*?\b(?:user story|story|bug|task|pbi|feature)\b\s*)?#?(\d{3,8})\s*[:.\-–—|)\]]*\s*(.*)$/i
const URL_RE = /(https?:\/\/\S+)/i

/** Turn OCR text (or pasted text) into "number + title" rows. A link on the same line becomes that story's link. */
export function parseStories(text: string): ParsedStory[] {
  // Bullets and table borders at the edges are noise; a " | " inside a title (common in ADO) is kept.
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[•●○◆■□]/g, ' ').replace(/^[\s|]+|[\s|]+$/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const out: ParsedStory[] = []
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    const url = line.match(URL_RE)?.[1]
    if (url) line = line.replace(url, ' ').replace(/\s+/g, ' ').trim()
    // A bare story link with no number in front: take the number from the link itself.
    if (!line && url) { const n = url.match(/(\d{3,8})(?!.*\d{3,8})/)?.[1]; if (n) line = n }
    const m = line.match(NUM_LINE)
    if (!m) continue
    let [, number, title] = m
    // Number alone on a line: the title is usually the next line.
    if (!title && lines[i + 1] && !NUM_LINE.test(lines[i + 1]) && !URL_RE.test(lines[i + 1])) { title = lines[i + 1]; i++ }
    title = title
      .replace(/\s*\|\s*\d+(\.\d+)?\s*(pts?|points?)?\s*$/i, '') // trailing "| 5" effort column
      .replace(/\s+\d+(\.\d+)?\s*(pts?|points?)?$/i, '') // trailing "5 pts"
      .replace(/[\s|]+$/, '')
      .trim()
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
