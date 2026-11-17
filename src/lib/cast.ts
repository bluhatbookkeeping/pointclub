// Original heist crew. `image` gets filled in once the Higgsfield portraits are generated.
export interface CastMember { id: string; name: string; role: string; color: string; image?: string }
export const CAST: CastMember[] = [
  { id: 'fixer', name: 'The Fixer', role: 'Calls the shots', color: '#FF5A36' },
  { id: 'wheelman', name: 'Wheelman', role: 'Gets us out', color: '#2F6BFF' },
  { id: 'hacker', name: 'Hacker', role: 'Owns the network', color: '#12B886' },
  { id: 'face', name: 'The Face', role: 'Talks past security', color: '#F59F00' },
  { id: 'safecracker', name: 'Safecracker', role: 'Hears the tumblers', color: '#7048E8' },
  { id: 'lookout', name: 'Lookout', role: 'Sees it first', color: '#E64980' },
  { id: 'insideman', name: 'Inside Man', role: 'Already on payroll', color: '#0CA678' },
  { id: 'forger', name: 'Forger', role: 'Makes it look real', color: '#D9480F' },
  { id: 'muscle', name: 'Muscle', role: 'Moves the heavy stuff', color: '#C92A2A' },
  { id: 'gadget', name: 'Gadget', role: 'Built it last night', color: '#1098AD' },
  { id: 'grifter', name: 'Grifter', role: 'Never the same name', color: '#AE3EC9' },
  { id: 'pilot', name: 'Pilot', role: 'Above it all', color: '#3B5BDB' },
  { id: 'planner', name: 'Planner', role: 'Has a backup plan', color: '#5C940D' },
  { id: 'locksmith', name: 'Locksmith', role: 'No door says no', color: '#E8590C' },
  { id: 'driver', name: 'Driver', role: 'Engine running', color: '#1971C2' },
  { id: 'diver', name: 'Diver', role: 'Goes in deep', color: '#099268' },
  { id: 'ghost', name: 'Ghost', role: 'Was never here', color: '#868E96' },
  { id: 'ace', name: 'Ace', role: 'Luck on demand', color: '#F03E3E' },
]
export const castById = (id: string) => CAST.find((c) => c.id === id) ?? CAST[0]
