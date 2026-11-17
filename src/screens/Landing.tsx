import { motion } from 'framer-motion'

export function Landing() {
  const open = () => {
    const id = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)
    location.search = '?room=' + id
  }
  return (
    <div className="min-h-screen grid place-items-center text-center">
      <div>
        <motion.h1 initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-8xl font-bold tracking-wide">
          POINT<span className="text-accent">CLUB</span>
        </motion.h1>
        <p className="mt-4 text-ink/70 max-w-md mx-auto">Planning poker for the crew. Open a theater once, share the link with the team, and come back to the same link every sprint.</p>
        <button className="btn-gold mt-8 text-lg" onClick={open}>Open a new table</button>
      </div>
    </div>
  )
}
