import confetti from 'canvas-confetti'
import { CAST } from './cast'
const cash = confetti.shapeFromText ? confetti.shapeFromText({ text: '💵', scalar: 2 }) : undefined
const coin = confetti.shapeFromText ? confetti.shapeFromText({ text: '🪙', scalar: 2 }) : undefined
const colors = CAST.slice(0, 8).map((c) => c.color)

/** Clean job: money rain and crew-coloured confetti. */
export function blockbusterBurst() {
  const end = Date.now() + 1600
  ;(function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.8 }, colors })
    confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.8 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
  if (cash) confetti({ shapes: [cash], scalar: 2.2, particleCount: 30, spread: 160, startVelocity: 30, origin: { y: 0.05 }, gravity: 0.6, drift: 0.4, ticks: 260 })
}
export function sparkleBurst() {
  confetti({ particleCount: 50, spread: 80, origin: { y: 0.5 }, colors })
  if (coin) confetti({ shapes: [coin], scalar: 1.8, particleCount: 10, spread: 90, origin: { y: 0.5 } })
}
export const clearFx = () => confetti.reset()
