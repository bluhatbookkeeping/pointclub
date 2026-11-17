// Original cast. Emoji stand-ins until the Higgsfield portraits are generated.
export interface CastMember { id: string; name: string; emoji: string; color: string; image?: string }
export const CAST: CastMember[] = [
  { id: 'owl', name: 'Director Owl', emoji: '🦉', color: '#b5835a' },
  { id: 'raccoon', name: 'Stunt Raccoon', emoji: '🦝', color: '#8d8d99' },
  { id: 'octopus', name: 'Boom-Mic Octopus', emoji: '🐙', color: '#e0607e' },
  { id: 'dino', name: 'Leading Dino', emoji: '🦖', color: '#4caf7a' },
  { id: 'panda', name: 'Popcorn Panda', emoji: '🐼', color: '#e8e8e8' },
  { id: 'robot', name: 'Usher Robot', emoji: '🤖', color: '#7fb3d5' },
  { id: 'fox', name: 'Femme Fox', emoji: '🦊', color: '#f08a3c' },
  { id: 'alien', name: 'B-Movie Alien', emoji: '👽', color: '#9be36d' },
  { id: 'frog', name: 'Crooner Frog', emoji: '🐸', color: '#5fbf5f' },
  { id: 'tiger', name: 'Screen Tiger', emoji: '🐯', color: '#f5a623' },
  { id: 'penguin', name: 'Tuxedo Penguin', emoji: '🐧', color: '#3c4a5c' },
  { id: 'unicorn', name: 'Special FX Unicorn', emoji: '🦄', color: '#d79cf0' },
  { id: 'bear', name: 'Gaffer Bear', emoji: '🐻', color: '#a0522d' },
  { id: 'cat', name: 'Critic Cat', emoji: '🐱', color: '#f2c14e' },
  { id: 'koala', name: 'Projectionist Koala', emoji: '🐨', color: '#9aa5b1' },
  { id: 'monkey', name: 'Clapper Monkey', emoji: '🐵', color: '#c68642' },
  { id: 'lion', name: 'Studio Lion', emoji: '🦁', color: '#e9b44c' },
  { id: 'ghost', name: 'Horror Ghost', emoji: '👻', color: '#dcdcf5' },
]
export const castById = (id: string) => CAST.find((c) => c.id === id) ?? CAST[0]
