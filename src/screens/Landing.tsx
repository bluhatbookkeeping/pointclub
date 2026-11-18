import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/Logo'

export function Landing() {
  const open = () => { location.href = '/' + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6) }
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="max-w-xl text-center flex flex-col items-center gap-6">
        <Badge variant="secondary" className="rounded-full">Planning poker · no logins</Badge>
        <Logo big />
        <p className="text-lg text-muted-foreground">Planning poker for your team. Open a room once, share the link, and use the same link every week.</p>
        <Button size="lg" onClick={open}>Open a new table <ArrowRight /></Button>
      </div>
    </div>
  )
}
