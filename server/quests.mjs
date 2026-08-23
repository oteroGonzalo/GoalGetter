import crypto from 'node:crypto'

/** Pseudo-activity id used for automatic quest bonus log entries. */
export const QUEST_ACTIVITY_ID = '__quest__'

/** How many quests are drawn from the pool each day. */
export const QUESTS_PER_DAY = 3

/**
 * Metric kinds a quest can measure, all instantly checkable from today's
 * non-bonus log entries (nothing that can only be judged once the day is over):
 *   players        — distinct players with a positive log
 *   logs           — number of positive logs (team)
 *   points         — points earned today (team)
 *   unit-quantity  — quantity summed over activities whose unit contains `match`
 *   before-hour    — 1 once any positive log lands before `hour`
 *   points-each    — per-player points, each capped at `perPlayer`
 */
export const METRIC_KINDS = [
  'players',
  'logs',
  'points',
  'unit-quantity',
  'before-hour',
  'points-each',
]

/** The out-of-the-box pool. Quests are plain data so Settings can edit them. */
export function defaultQuestPool() {
  return [
    {
      id: 'duo-day',
      name: 'Team Spirit',
      emoji: '🤝',
      description: 'Both players log a positive activity today',
      bonus: 20,
      target: 2,
      unit: 'players',
      metric: { kind: 'players' },
    },
    {
      id: 'triple-threat',
      name: 'Triple Threat',
      emoji: '🎯',
      description: 'Log 3 positive activities today (team)',
      bonus: 15,
      target: 3,
      unit: 'logs',
      metric: { kind: 'logs' },
    },
    {
      id: 'big-push',
      name: 'Big Push',
      emoji: '🚀',
      description: 'Earn 60 points today (team)',
      bonus: 25,
      target: 60,
      unit: 'pts',
      metric: { kind: 'points' },
    },
    {
      id: 'page-turner',
      name: 'Page Turner',
      emoji: '📖',
      description: 'Read 15 pages today (team)',
      bonus: 15,
      target: 15,
      unit: 'pages',
      metric: { kind: 'unit-quantity', match: 'page' },
    },
    {
      id: 'sweat-session',
      name: 'Sweat Session',
      emoji: '💦',
      description: 'Exercise 40 minutes today (team)',
      bonus: 20,
      target: 40,
      unit: 'min',
      metric: { kind: 'unit-quantity', match: 'min' },
    },
    {
      id: 'early-riser',
      name: 'Early Riser',
      emoji: '🌅',
      description: 'Log a positive activity before 10:00 am',
      bonus: 10,
      target: 1,
      unit: 'early log',
      metric: { kind: 'before-hour', hour: 10 },
    },
    {
      id: 'power-pair',
      name: 'Power Pair',
      emoji: '⚡',
      description: 'Each player earns 25+ points today',
      bonus: 25,
      target: 50,
      unit: 'pts (25 each)',
      metric: { kind: 'points-each', perPlayer: 25 },
    },
  ]
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** Small seeded PRNG so both players (and the client) see the same quests all day. */
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function unitMatches(state, entry, match) {
  const activity = state.activities.find((a) => a.id === entry.activityId)
  return activity ? activity.unit.toLowerCase().includes(String(match).toLowerCase()) : false
}

/** Progress toward a quest's target, computed from its metric over today's entries. */
function computeProgress(quest, entries, state) {
  const positive = entries.filter((e) => e.points > 0)
  const metric = quest.metric ?? {}
  switch (metric.kind) {
    case 'players':
      return new Set(positive.map((e) => e.playerId)).size
    case 'logs':
      return positive.length
    case 'points':
      return positive.reduce((sum, e) => sum + e.points, 0)
    case 'unit-quantity':
      return positive
        .filter((e) => unitMatches(state, e, metric.match ?? ''))
        .reduce((sum, e) => sum + e.quantity, 0)
    case 'before-hour':
      return positive.some((e) => new Date(e.timestamp).getHours() < (metric.hour ?? 10)) ? 1 : 0
    case 'points-each': {
      const cap = metric.perPlayer ?? Math.ceil(quest.target / 2)
      const byPlayer = {}
      for (const e of positive) byPlayer[e.playerId] = (byPlayer[e.playerId] ?? 0) + e.points
      return Math.min(cap, byPlayer.p1 ?? 0) + Math.min(cap, byPlayer.p2 ?? 0)
    }
    default:
      return 0
  }
}

/** The quests for a given date, picked deterministically from the editable pool. */
export function todaysQuestDefs(state, now = new Date()) {
  const pool = Array.isArray(state.questPool) ? state.questPool : defaultQuestPool()
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
  const rand = mulberry32(seed)
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, QUESTS_PER_DAY)
}

function todaysEntries(state, now) {
  const today = dayKey(now)
  return state.log.filter((e) => !e.questId && dayKey(new Date(e.timestamp)) === today)
}

/** Today's quests with live progress, for the API response. Not persisted. */
export function computeQuests(state, now = new Date()) {
  const entries = todaysEntries(state, now)
  const today = dayKey(now)
  return todaysQuestDefs(state, now).map((q) => {
    const progress = computeProgress(q, entries, state)
    const awarded = state.log.some(
      (e) => e.questId === q.id && dayKey(new Date(e.timestamp)) === today,
    )
    return {
      id: q.id,
      name: q.name,
      emoji: q.emoji,
      description: q.description,
      bonus: q.bonus,
      target: q.target,
      unit: q.unit,
      progress,
      completed: awarded || progress >= q.target,
      awarded,
    }
  })
}

/**
 * Append bonus log entries for any of today's quests that are completed but
 * not yet awarded. The triggering player gets the credit. Returns the entries.
 */
export function evaluateQuests(state, playerId, now = new Date()) {
  const created = []
  for (const q of computeQuests(state, now)) {
    if (!q.completed || q.awarded) continue
    created.push({
      id: crypto.randomUUID(),
      activityId: QUEST_ACTIVITY_ID,
      playerId,
      quantity: 1,
      points: q.bonus,
      timestamp: now.getTime(),
      questId: q.id,
      questName: q.name,
      questEmoji: q.emoji,
    })
  }
  state.log.push(...created)
  return created
}
