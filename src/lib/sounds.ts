// All sounds are synthesized with Web Audio: no files to download.
let ctx: AudioContext | null = null
let muted = (() => { try { return localStorage.getItem('pointclub:muted') === '1' } catch { return false } })()
export const isMuted = () => muted
export function setMuted(m: boolean) { muted = m; try { localStorage.setItem('pointclub:muted', m ? '1' : '0') } catch { /* */ } }
function ac() { if (!ctx) ctx = new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); return ctx }

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.15) {
  const c = ac(), o = c.createOscillator(), g = c.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0, c.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  o.connect(g).connect(c.destination); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05)
}
function noise(start: number, dur: number, freq: number, gain = 0.08) {
  const c = ac(), len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = gain
  s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + start)
}

export const sfx = {
  pick() { if (!muted) tone(660, 0, 0.08, 'triangle', 0.1) },
  beep(final = false) { if (!muted) tone(final ? 1320 : 880, 0, final ? 0.35 : 0.15, 'square', 0.06) },
  whir() { if (muted) return; for (let i = 0; i < 12; i++) noise(i * 0.12, 0.06, 2400, 0.05) },
  fanfare() {
    if (muted) return
    const n = [523, 659, 784, 1047]
    n.forEach((f, i) => tone(f, i * 0.12, 0.3, 'sawtooth', 0.07))
    ;[523, 659, 784].forEach((f) => tone(f * 2, 0.55, 0.9, 'triangle', 0.07))
  },
  sparkle() { if (!muted) [1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.08, 0.25, 'sine', 0.08)) },
  scratch() {
    if (muted) return
    const c = ac(), o = c.createOscillator(), g = c.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(900, c.currentTime); o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.4)
    g.gain.setValueAtTime(0.12, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.45)
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + 0.5)
    noise(0, 0.4, 600, 0.1)
  },
  pop() { if (!muted) tone(300 + Math.random() * 400, 0, 0.06, 'square', 0.08) },
  splat() { if (!muted) noise(0, 0.25, 300, 0.25) },
}
