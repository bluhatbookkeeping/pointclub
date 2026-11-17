import { Spade } from 'lucide-react'
export function Logo({ big = false }: { big?: boolean }) {
  return (
    <div className={`flex items-center gap-2 font-semibold tracking-tight ${big ? 'text-4xl' : 'text-base'}`}>
      <span className={`grid place-items-center rounded-md bg-primary text-primary-foreground ${big ? 'h-12 w-12' : 'h-7 w-7'}`}><Spade className={big ? 'h-6 w-6' : 'h-4 w-4'} /></span>
      <span>Point<span className="text-accent">Club</span></span>
    </div>
  )
}
