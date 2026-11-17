/** 'pass' = sitting this story out: counts as done, ignored in the result. Not a card in the hand. */
export type CardValue = '1' | '2' | '3' | '5' | '8' | '13' | '21' | '?' | 'coffee' | 'pass'
export const DECK: CardValue[] = ['1', '2', '3', '5', '8', '13', '21', '?', 'coffee']
export const NUMERIC: CardValue[] = ['1', '2', '3', '5', '8', '13', '21']

export interface Member {
  id: string
  roomId: string
  name: string
  character: string
  status: 'here' | 'away'
  lastSeen: number
}
export interface Sprint {
  id: string
  roomId: string
  name: string // "Sprint 42"
  title: string // "The Login Refactor"
  startedAt: number
  closedAt: number | null
}
export type Outcome = 'blockbuster' | 'critics' | 'plottwist' | 'none'
export interface Story {
  id: string
  roomId: string
  sprintId: string
  number: string
  title: string
  url: string
  points: string | null
  outcome: Outcome | null
  rounds: number
  order: number
  /** Skipped this sprint (needs more info); carried to the next sprint when it's wrapped. */
  skipped?: boolean | null
  /** Why it was skipped / what's needed. */
  note?: string | null
}
export interface Vote {
  id: string // `${storyId}:${round}:${memberId}`
  roomId: string
  storyId: string
  memberId: string
  round: number
  value: CardValue
}
export interface Room {
  id: string
  name: string
  hostId: string | null
  activeSprintId: string | null
  currentStoryId: string | null
  revealed: boolean
  round: number
  adoPattern: string
  /** How many backlog stories sit above the "Next session" line (default 6). */
  nextCount?: number | null
  /** The host deals (doesn't vote) unless this is true. */
  hostVotes?: boolean | null
}
export interface Snapshot {
  room: Room | null
  members: Member[]
  sprints: Sprint[]
  stories: Story[]
  votes: Vote[]
}
export type LiveEvent =
  | { kind: 'throw'; from: string; to: string; item: string }
  | { kind: 'react'; from: string; emoji: string }
