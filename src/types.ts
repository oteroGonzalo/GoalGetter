import type { PetState } from './pet'

export type PlayerId = 'p1' | 'p2'

export interface Player {
  id: PlayerId
  name: string
  avatar: string
}

export interface Activity {
  id: string
  name: string
  emoji: string
  /** What one unit means: "min", "pages", "meals", "drinks"... */
  unit: string
  /** Points per unit. Negative for penalties. */
  pointsPerUnit: number
  /** Point objective for this activity. 0 for penalties (they only subtract from the total). */
  target: number
}

export interface LogEntry {
  id: string
  activityId: string
  playerId: PlayerId
  /** How many units were logged (minutes, pages, drinks...). */
  quantity: number
  /** Points awarded, computed by the server at log time — editing an activity never rewrites history. */
  points: number
  timestamp: number
  /** Set when this entry came from logging progress on a book. */
  bookId?: string
  /** True when the log landed a critical hit and the points were doubled. */
  crit?: boolean
  /** Set on automatic daily-quest bonus entries, along with questName/questEmoji. */
  questId?: string
  questName?: string
  questEmoji?: string
}

export type QuestMetricKind =
  | 'players'
  | 'logs'
  | 'points'
  | 'unit-quantity'
  | 'before-hour'
  | 'points-each'

/** How a quest measures progress from today's log. */
export interface QuestMetric {
  kind: QuestMetricKind
  /** unit-quantity: activities whose unit contains this text count toward progress. */
  match?: string
  /** before-hour: a positive log must land before this hour (0–23). */
  hour?: number
  /** points-each: per-player cap on counted points (target is usually 2× this). */
  perPlayer?: number
}

/** An editable quest in the pool; a few are drawn from the pool each day. */
export interface QuestDef {
  id: string
  name: string
  emoji: string
  description: string
  /** Bonus points awarded on completion. */
  bonus: number
  target: number
  /** Display label for the target ("pts", "pages", "logs"...). */
  unit: string
  metric: QuestMetric
}

/** A daily quest, computed by the server for the current day. */
export interface Quest {
  id: string
  name: string
  emoji: string
  description: string
  /** Bonus points awarded on completion. */
  bonus: number
  target: number
  unit: string
  progress: number
  completed: boolean
  /** True once the bonus entry has been added to the log today. */
  awarded: boolean
}

export interface Book {
  id: string
  title: string
  totalPages: number
  /** How far into the book the readers currently are. */
  currentPage: number
  /** Which activity book progress is credited to (usually the "Reading" activity). */
  activityId: string
  createdAt: number
}

export interface GameState {
  players: [Player, Player]
  activities: Activity[]
  log: LogEntry[]
  books: Book[]
  /** What the team wins when the goal is reached. */
  prize: string
  /** The shared site cat — one cat for both players. */
  pet?: PetState
  /** Today's daily quests — computed by the server, never persisted. */
  quests?: Quest[]
  /** The editable pool today's quests are drawn from. */
  questPool?: QuestDef[]
}
