import { sfx } from './sounds'
import { voice } from './voice'

/** Things you can throw at a teammate: each says what it means, lands with a comic word, and has its own sound. */
export const REACTIONS = [
  { item: '💵', name: 'Cash', meaning: 'Nice work', word: 'CHA-CHING!', color: '#15803d', sound: () => voice.effect('chaching', 0.5) },
  { item: '🪙', name: 'Coin', meaning: 'Thanks', word: 'PLINK!', color: '#a16207', sound: () => voice.effect('chips', 0.6) },
  { item: '🍅', name: 'Tomato', meaning: 'Boo! Really?', word: 'SPLAT!', color: '#dc2626', sound: () => { sfx.splat(); voice.effect('boom', 0.25) } },
  { item: '🌹', name: 'Rose', meaning: 'Great point', word: 'BRAVO!', color: '#be185d', sound: () => sfx.sparkle() },
  { item: '☕', name: 'Coffee', meaning: 'Need a break', word: 'BREAK TIME!', color: '#92400e', sound: () => sfx.pop() },
] as const
export const reactionFor = (item: string) => REACTIONS.find((r) => r.item === item) ?? REACTIONS[0]

/** Friendly nudges for whoever hasn't voted yet. {name} is filled in. */
export const NUDGES = [
  "Hey {name}, we're still waiting on you. Got a number?",
  'Earth to {name}! Ready to vote?',
  'All eyes on {name}. Do you have a number?',
  '{name}, take your time… just not too much time.',
  "The table's waiting, {name}. What's your card?",
  '{name}, the cards are getting cold. Ready?',
]
export const nudgeLine = (i: number, names: string[]) => {
  const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? ''
  return NUDGES[i % NUDGES.length].replace('{name}', who)
}
