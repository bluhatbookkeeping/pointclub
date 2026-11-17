// Recorded crew voice lines and casino sound effects (public/sfx/**). Missing files fail silently,
// so the game still works if a clip hasn't been generated yet.
import { isMuted } from './sounds'

const KEY = 'pointclub:voices'
let voicesOn = (() => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } })()
export const voicesEnabled = () => voicesOn
export function setVoicesEnabled(on: boolean) { voicesOn = on; try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* */ } }

const cache = new Map<string, HTMLAudioElement>()
function clip(path: string) {
  let a = cache.get(path)
  if (!a) { a = new Audio(`/sfx/${path}.mp3`); a.preload = 'auto'; cache.set(path, a) }
  return a
}

let speaking: HTMLAudioElement | null = null
/** Play one voice line. If another line is still talking, skip (unless `interrupt`), so a burst of votes doesn't pile up. */
function say(path: string, interrupt = false) {
  if (isMuted() || !voicesOn) return
  if (speaking && !speaking.paused && !speaking.ended && !interrupt) return
  speaking?.pause()
  const a = clip(path); a.currentTime = 0; a.volume = 0.9
  speaking = a
  a.play().catch(() => {})
}
/** Sound effects overlap freely (each play uses a fresh copy). */
function fx(name: string, volume = 0.6) {
  if (isMuted()) return
  const a = clip(`sfx/${name}`).cloneNode(true) as HTMLAudioElement
  a.volume = volume
  a.play().catch(() => {})
}

const POINT_LINES = new Set(['1', '2', '3', '5', '8', '13', '21'])
export const voice = {
  /** Warm the browser cache so the first line plays instantly. */
  preload(characters: string[]) {
    for (const c of characters) clip(`voice/${c}`)
    for (const n of ['clean', 'close', 'compromised', 'wrap', 'p1', 'p2', 'p3', 'p5', 'p8', 'p13', 'p21']) clip(`narr/${n}`)
    for (const n of ['chips', 'chaching', 'alarm', 'boom']) clip(`sfx/${n}`)
  },
  vote(character: string) { fx('chips', 0.5); say(`voice/${character}`) },
  reveal() { fx('boom', 0.7) },
  cleanJob() { fx('chaching', 0.6); setTimeout(() => say('narr/clean', true), 500) },
  closeEnough() { say('narr/close', true) },
  compromised() { fx('alarm', 0.45); setTimeout(() => say('narr/compromised', true), 400) },
  lockedIn(points: string) { if (POINT_LINES.has(points)) say(`narr/p${points}`, true) },
  wrap() { say('narr/wrap', true) },
}
