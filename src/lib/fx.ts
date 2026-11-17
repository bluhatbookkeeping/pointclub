import confetti from 'canvas-confetti'
const popcorn = confetti.shapeFromText ? confetti.shapeFromText({ text: '🍿', scalar: 2 }) : undefined
const star = confetti.shapeFromText ? confetti.shapeFromText({ text: '⭐', scalar: 2 }) : undefined

export function blockbusterBurst() {
  const end = Date.now() + 1800
  const colors = ['#ffd166', '#f4b400', '#ffffff', '#e0607e']
  ;(function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.8 }, colors })
    confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.8 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
  if (popcorn) confetti({ shapes: [popcorn], scalar: 2, particleCount: 40, spread: 160, startVelocity: 35, origin: { y: 0.1 }, gravity: 0.8, ticks: 300 })
}
export function sparkleBurst() {
  confetti({ particleCount: 60, spread: 90, origin: { y: 0.45 }, colors: ['#ffe8a3', '#ffffff'], scalar: 0.8 })
  if (star) confetti({ shapes: [star], scalar: 1.6, particleCount: 12, spread: 100, origin: { y: 0.45 } })
}

export const clearFx = () => confetti.reset()
