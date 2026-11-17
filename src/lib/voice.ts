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
/** Quiet looping music while the team votes. One shared player; fades in and out. Respects mute. */
let thinking: HTMLAudioElement | null = null
let fadeT: ReturnType<typeof setInterval> | null = null
export function votingMusic(on: boolean, volume = 0.18) {
  if (on && isMuted()) on = false
  if (on && !thinking) { thinking = new Audio('/sfx/sfx/thinking.mp3'); thinking.loop = true; thinking.volume = 0; (window as any).__votingMusic = thinking }
  if (!thinking) return
  const a = thinking
  if (fadeT) clearInterval(fadeT)
  if (on && a.paused) a.play().catch(() => {})
  fadeT = setInterval(() => {
    const target = on ? volume : 0
    const v = a.volume + (target > a.volume ? 0.02 : -0.02)
    a.volume = Math.max(0, Math.min(1, Math.abs(target - a.volume) < 0.02 ? target : v))
    if (a.volume === target) { if (fadeT) clearInterval(fadeT); fadeT = null; if (!on) a.pause() }
  }, 50)
}

/** Upbeat credits music. Returns a stop function that fades it out. Respects mute. */
export function playMusic(name = 'credits', volume = 0.45, fadeAfterMs?: number): () => void {
  if (isMuted()) return () => {}
  const a = new Audio(`/sfx/sfx/${name}.mp3`)
  ;(window as any).__creditsMusic = a
  a.volume = volume
  a.play().catch(() => {})
  let fading = false
  const stop = () => {
    if (fading) return; fading = true
    const step = () => { if (a.volume > 0.03) { a.volume = Math.max(0, a.volume - 0.03); setTimeout(step, 60) } else { a.pause() } }
    step()
  }
  const t = fadeAfterMs ? setTimeout(stop, fadeAfterMs) : null
  return () => { if (t) clearTimeout(t); stop() }
}

/** Upbeat walk-in music while people arrive, before the dealer clicks Let's start. Plays at most 60 seconds. */
let walkIn: HTMLAudioElement | null = null
let walkFade: ReturnType<typeof setInterval> | null = null
let walkCap: ReturnType<typeof setTimeout> | null = null
let walkDone = false // after the 60-second cap, stay quiet until the next session
export function walkInMusic(on: boolean, volume = 0.3) {
  if (on && (isMuted() || walkDone)) on = false
  if (on && !walkIn) { walkIn = new Audio('/sfx/sfx/credits.mp3'); walkIn.loop = true; walkIn.volume = 0; (window as any).__walkInMusic = walkIn }
  if (!walkIn) return
  const a = walkIn
  if (walkFade) clearInterval(walkFade)
  if (on && a.paused) {
    a.play().catch(() => {})
    if (walkCap) clearTimeout(walkCap)
    walkCap = setTimeout(() => { walkDone = true; walkInMusic(false) }, 60_000)
  }
  if (!on && walkCap) { clearTimeout(walkCap); walkCap = null }
  walkFade = setInterval(() => {
    const target = on ? volume : 0
    a.volume = Math.abs(target - a.volume) < 0.02 ? target : Math.max(0, Math.min(1, a.volume + (target > a.volume ? 0.02 : -0.02)))
    if (a.volume === target) { if (walkFade) clearInterval(walkFade); walkFade = null; if (!on) a.pause() }
  }, 60)
}
/** A new session (next week) gets walk-in music again. */
export function resetWalkIn() { walkDone = false }

export const voice = {
  /** A short sound effect clip (chips, chaching, alarm, boom). */
  effect(name: string, volume = 0.6) { fx(name, volume) },
  /** Warm the browser cache so the first line plays instantly. */
  preload(characters: string[]) {
    for (const c of characters) clip(`voice/${c}`)
    for (const n of ['next', 'done', 'clean', 'close', 'compromised', 'wrap', 'p1', 'p2', 'p3', 'p5', 'p8', 'p13', 'p21']) clip(`narr/${n}`)
    for (const n of ['chips', 'chaching', 'alarm', 'boom']) clip(`sfx/${n}`)
  },
  vote(character: string) { fx('chips', 0.5); say(`voice/${character}`) },
  reveal() { fx('boom', 0.7) },
  cleanJob() { fx('chaching', 0.6); setTimeout(() => say('narr/clean', true), 500) },
  closeEnough() { say('narr/close', true) },
  compromised() { fx('alarm', 0.45); setTimeout(() => say('narr/compromised', true), 400) },
  lockedIn(points: string) { if (POINT_LINES.has(points)) say(`narr/p${points}`, true) },
  /** "Let's vote." for a new story, after any line that's still playing (e.g. the points just saved). */
  nextStory() {
    if (isMuted() || !voicesOn) return
    if (speaking && !speaking.paused && !speaking.ended) speaking.addEventListener('ended', () => say('narr/next'), { once: true })
    else say('narr/next')
  },
  wrap() { say('narr/wrap', true) },
  /** All stories pointed or skipped. Waits for the points line to finish first. */
  done() {
    if (isMuted() || !voicesOn) return
    fx('chaching', 0.5)
    if (speaking && !speaking.paused && !speaking.ended) speaking.addEventListener('ended', () => say('narr/done'), { once: true })
    else setTimeout(() => say('narr/done'), 300)
  },
}
