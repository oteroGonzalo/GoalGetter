import type { GameState, LogEntry, PlayerId, Quest, QuestDef } from './types'

export const QUEST_ACTIVITY_ID = '__quest__'
const QUESTS_PER_DAY = 3

export function defaultQuestPool(): QuestDef[] {
  return [
    {
      id: 'duo-day', name: 'Team Spirit', emoji: '🤝',
      description: 'Both players log a positive activity today', bonus: 20, target: 2,
      unit: 'players', metric: { kind: 'players' },
    },
    {
      id: 'triple-threat', name: 'Triple Threat', emoji: '🎯',
      description: 'Log 3 positive activities today (team)', bonus: 15, target: 3,
      unit: 'logs', metric: { kind: 'logs' },
    },
    {
      id: 'big-push', name: 'Big Push', emoji: '🚀',
      description: 'Earn 60 points today (team)', bonus: 25, target: 60,
      unit: 'pts', metric: { kind: 'points' },
    },
    {
      id: 'page-turner', name: 'Page Turner', emoji: '📖',
      description: 'Read 15 pages today (team)', bonus: 15, target: 15,
      unit: 'pages', metric: { kind: 'unit-quantity', match: 'page' },
    },
    {
      id: 'sweat-session', name: 'Sweat Session', emoji: '💦',
      description: 'Exercise 40 minutes today (team)', bonus: 20, target: 40,
      unit: 'min', metric: { kind: 'unit-quantity', match: 'min' },
    },
    {
      id: 'early-riser', name: 'Early Riser', emoji: '🌅',
      description: 'Log a positive activity before 10:00 am', bonus: 10, target: 1,
      unit: 'early log', metric: { kind: 'before-hour', hour: 10 },
    },
    {
      id: 'power-pair', name: 'Power Pair', emoji: '⚡',
      description: 'Each player earns 25+ points today', bonus: 25, target: 50,
      unit: 'pts (25 each)', metric: { kind: 'points-each', perPlayer: 25 },
    },
  ]
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function mulberry32(initialSeed: number): () => number {
  let seed = initialSeed
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function progressFor(quest: QuestDef, entries: LogEntry[], state: GameState): number {
  const positive = entries.filter((entry) => entry.points > 0)
  switch (quest.metric.kind) {
    case 'players':
      return new Set(positive.map((entry) => entry.playerId)).size
    case 'logs':
      return positive.length
    case 'points':
      return positive.reduce((sum, entry) => sum + entry.points, 0)
    case 'unit-quantity':
      return positive
        .filter((entry) => {
          const activity = state.activities.find((item) => item.id === entry.activityId)
          return activity?.unit.toLowerCase().includes((quest.metric.match ?? '').toLowerCase())
        })
        .reduce((sum, entry) => sum + entry.quantity, 0)
    case 'before-hour':
      return positive.some(
        (entry) => new Date(entry.timestamp).getHours() < (quest.metric.hour ?? 10),
      ) ? 1 : 0
    case 'points-each': {
      const cap = quest.metric.perPlayer ?? Math.ceil(quest.target / 2)
      const byPlayer: Partial<Record<PlayerId, number>> = {}
      for (const entry of positive) {
        byPlayer[entry.playerId] = (byPlayer[entry.playerId] ?? 0) + entry.points
      }
      return Math.min(cap, byPlayer.p1 ?? 0) + Math.min(cap, byPlayer.p2 ?? 0)
    }
  }
}

function todaysDefinitions(state: GameState, now: Date): QuestDef[] {
  const pool = Array.isArray(state.questPool) ? state.questPool : defaultQuestPool()
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
  const random = mulberry32(seed)
  const shuffled = [...pool]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
  }
  return shuffled.slice(0, QUESTS_PER_DAY)
}

export function computeQuests(state: GameState, now = new Date()): Quest[] {
  const today = dayKey(now)
  const entries = state.log.filter(
    (entry) => !entry.questId && dayKey(new Date(entry.timestamp)) === today,
  )
  return todaysDefinitions(state, now).map((quest) => {
    const progress = progressFor(quest, entries, state)
    const awarded = state.log.some(
      (entry) => entry.questId === quest.id && dayKey(new Date(entry.timestamp)) === today,
    )
    return {
      id: quest.id, name: quest.name, emoji: quest.emoji, description: quest.description,
      bonus: quest.bonus, target: quest.target, unit: quest.unit, progress,
      completed: awarded || progress >= quest.target, awarded,
    }
  })
}

export function evaluateQuests(
  state: GameState,
  playerId: PlayerId,
  now = new Date(),
): LogEntry[] {
  const created: LogEntry[] = []
  for (const quest of computeQuests(state, now)) {
    if (!quest.completed || quest.awarded) continue
    created.push({
      id: crypto.randomUUID(), activityId: QUEST_ACTIVITY_ID, playerId, quantity: 1,
      points: quest.bonus, timestamp: now.getTime(), questId: quest.id,
      questName: quest.name, questEmoji: quest.emoji,
    })
  }
  state.log.push(...created)
  return created
}
