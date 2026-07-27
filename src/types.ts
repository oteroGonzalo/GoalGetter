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
}
