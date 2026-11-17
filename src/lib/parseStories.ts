export interface ParsedStory { number: string; title: string }

const NUM_LINE = /^(?:.*?\b(?:user story|story|bug|task|pbi|feature)\b\s*)?#?(\d{3,8})\s*[:.\-–—|)\]]*\s*(.*)$/i

/** Turn OCR text (or pasted text) into "number + title" rows. */
export function parseStories(text: string): ParsedStory[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/[|•●○◆■□]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const out: ParsedStory[] = []
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(NUM_LINE)
    if (!m) continue
    let [, number, title] = m
    // Number alone on a line: the title is usually the next line.
    if (!title && lines[i + 1] && !NUM_LINE.test(lines[i + 1])) { title = lines[i + 1]; i++ }
    title = title.replace(/\s+\d+(\.\d+)?\s*(pts?|points?)?$/i, '').trim() // drop trailing effort columns
    if (!title || title.length < 3 || seen.has(number)) continue
    seen.add(number)
    out.push({ number, title })
  }
  return out
}

export const buildAdoUrl = (pattern: string, number: string) => (pattern ? pattern.replace('{id}', number) : '')
