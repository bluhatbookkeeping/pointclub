import { motion } from 'framer-motion'

export function Landing() {
  const open = () => {
    const id = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)
    location.search = '?room=' + id
  }
  return (
    <div className="min-h-screen grid place-items-center text-center">
      <div>
        <motion.h1 initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-6xl text-marquee-400 drop-shadow-[0_0_18px_rgba(255,209,102,.6)]">
          POINT CLUB<br />CINEMA
        </motion.h1>
        <p className="mt-4 text-white/70 max-w-md mx-auto">Planning poker with popcorn. Open a theater once, share the link with the team, and come back to the same link every sprint.</p>
        <button className="btn-gold mt-8 text-lg" onClick={open}>🎬 Open a new theater</button>
      </div>
    </div>
  )
}
