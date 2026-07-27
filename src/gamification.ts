import type { GameState, LogEntry, PlayerId } from './types'

export interface Totals {
  /** Net team total (penalties included), floored at whatever it really is — can go negative. */
  total: number
  goal: number
  pct: number
  byPlayer: Record<PlayerId, number>
  byActivity: Record<string, number>
  penaltyPoints: number
}

export function computeTotals(state: GameState): Totals {
  const byPlayer: Record<PlayerId, number> = { p1: 0, p2: 0 }
  const byActivity: Record<string, number> = {}
  let total = 0
  let penaltyPoints = 0
  for (const entry of state.log) {
    total += entry.points
    byPlayer[entry.playerId] += entry.points
    byActivity[entry.activityId] = (byActivity[entry.activityId] ?? 0) + entry.points
    if (entry.points < 0) penaltyPoints += entry.points
  }
  const goal = state.activities.reduce((sum, a) => sum + Math.max(0, a.target), 0)
  const pct = goal > 0 ? Math.max(0, Math.min(100, (total / goal) * 100)) : 0
  return { total, goal, pct, byPlayer, byActivity, penaltyPoints }
}

const LEVEL_TITLES = [
  'Couch Potatoes',
  'Warm-Ups',
  'Rookies',
  'Go-Getters',
  'Grinders',
  'Achievers',
  'Champions',
  'Heroes',
  'Legends',
  'Immortals',
]

export interface LevelInfo {
  level: number
  title: string
  /** Points into the current level (0 to xpPerLevel - 1). */
  xpInLevel: number
  /** Cost of the current level: 100 at level 1, growing by 50 each level. */
  xpPerLevel: number
}

export function levelInfo(total: number): LevelInfo {
  let safe = Math.max(0, total)
  let level = 1
  let xpPerLevel = 100
  while (safe >= xpPerLevel) {
    safe -= xpPerLevel
    level++
    xpPerLevel += 50
  }
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]
  return { level, title, xpInLevel: safe, xpPerLevel }
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** Consecutive days (ending today or yesterday) on which the player logged something positive. */
export function currentStreak(log: LogEntry[], playerId: PlayerId): number {
  const days = new Set(
    log.filter((e) => e.playerId === playerId && e.points > 0).map((e) => dayKey(new Date(e.timestamp))),
  )
  const cursor = new Date()
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export interface Forecast {
  /** Net points per day over the recent window. */
  ratePerDay: number
  /** Days until the goal at the current rate; null if the pace is zero or negative. */
  daysLeft: number | null
  eta: Date | null
}

/** Projects when the team reaches the goal, based on net points over the last 14 days. */
export function computeForecast(state: GameState, totals: Totals): Forecast | null {
  if (state.log.length === 0) return null
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const windowMs = 14 * dayMs
  const firstTs = Math.min(...state.log.map((e) => e.timestamp))
  const elapsedDays = Math.max(1, Math.min(windowMs, now - firstTs) / dayMs)
  const windowPoints = state.log
    .filter((e) => e.timestamp >= now - windowMs)
    .reduce((sum, e) => sum + e.points, 0)
  const ratePerDay = windowPoints / elapsedDays
  const remaining = totals.goal - totals.total
  if (remaining <= 0) return { ratePerDay, daysLeft: 0, eta: new Date(now) }
  if (ratePerDay <= 0) return { ratePerDay, daysLeft: null, eta: null }
  const daysLeft = Math.ceil(remaining / ratePerDay)
  return { ratePerDay, daysLeft, eta: new Date(now + daysLeft * dayMs) }
}

export interface Achievement {
  id: string
  name: string
  emoji: string
  description: string
  earned: boolean
}

export function computeAchievements(state: GameState, totals: Totals): Achievement[] {
  const { log } = state
  const positives = log.filter((e) => e.points > 0)
  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const lastWeek = log.filter((e) => e.timestamp >= weekAgo)

  const streaks = [currentStreak(log, 'p1'), currentStreak(log, 'p2')]
  const bestStreak = Math.max(...streaks)

  const daysByPlayer: Record<PlayerId, Set<string>> = { p1: new Set(), p2: new Set() }
  for (const e of positives) daysByPlayer[e.playerId].add(dayKey(new Date(e.timestamp)))
  const sharedDay = [...daysByPlayer.p1].some((d) => daysByPlayer.p2.has(d))

  const countByPlayerDay = new Map<string, number>()
  for (const e of positives) {
    const key = `${e.playerId}|${dayKey(new Date(e.timestamp))}`
    countByPlayerDay.set(key, (countByPlayerDay.get(key) ?? 0) + 1)
  }
  const beastMode = [...countByPlayerDay.values()].some((n) => n >= 5)

  const positiveActivities = state.activities.filter((a) => a.pointsPerUnit > 0)
  const allRounder =
    positiveActivities.length > 0 && positiveActivities.every((a) => (totals.byActivity[a.id] ?? 0) > 0)

  return [
    {
      id: 'first-steps',
      name: 'First Steps',
      emoji: '👟',
      description: 'Log your first activity',
      earned: positives.length > 0,
    },
    {
      id: 'dynamic-duo',
      name: 'Dynamic Duo',
      emoji: '🤝',
      description: 'Both players score on the same day',
      earned: sharedDay,
    },
    {
      id: 'century',
      name: 'Century Club',
      emoji: '💯',
      description: 'Reach 100 team points',
      earned: totals.total >= 100,
    },
    {
      id: 'streak-3',
      name: 'On a Roll',
      emoji: '🔥',
      description: '3-day streak by either player',
      earned: bestStreak >= 3,
    },
    {
      id: 'streak-7',
      name: 'Unstoppable',
      emoji: '⚡',
      description: '7-day streak by either player',
      earned: bestStreak >= 7,
    },
    {
      id: 'beast-mode',
      name: 'Beast Mode',
      emoji: '🦁',
      description: '5+ activities in one day by one player',
      earned: beastMode,
    },
    {
      id: 'all-rounder',
      name: 'All-Rounder',
      emoji: '🎯',
      description: 'Score in every positive activity',
      earned: allRounder,
    },
    {
      id: 'clean-week',
      name: 'Clean Week',
      emoji: '🧼',
      description: '3+ good deeds and zero penalties in the last 7 days',
      earned:
        lastWeek.filter((e) => e.points > 0).length >= 3 && lastWeek.every((e) => e.points > 0),
    },
    {
      id: 'halfway',
      name: 'Halfway There',
      emoji: '⛰️',
      description: 'Reach 50% of the team goal',
      earned: totals.pct >= 50,
    },
    {
      id: 'goal',
      name: 'Quest Complete',
      emoji: '🏆',
      description: 'Reach the team goal',
      earned: totals.goal > 0 && totals.total >= totals.goal,
    },
  ]
}
