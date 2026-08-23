import type { Activity, Book, GameState, LogEntry, Player, PlayerId, QuestDef } from './types'
import { evaluateQuests } from './quests'
import { fetchGithubState, mutateGithubState, subscribeStorageStatus } from './githubStorage'

const CRIT_CHANCE = 0.01

function fail(message: string): never {
  throw new Error(message)
}

function readingActivity(state: GameState): Activity | undefined {
  return (
    state.activities.find((activity) => activity.id === 'reading') ??
    state.activities.find(
      (activity) => activity.pointsPerUnit >= 0 && /page/i.test(activity.unit),
    ) ??
    state.activities.find((activity) => activity.pointsPerUnit >= 0)
  )
}

function sanitizeQuestPool(pool: QuestDef[]): QuestDef[] {
  return pool.map((quest) => {
    const name = quest.name.trim()
    if (!name) fail('Every quest needs a name')
    if (!Number.isFinite(quest.bonus) || quest.bonus <= 0) {
      fail(`Quest "${name}": bonus must be a positive number`)
    }
    if (!Number.isFinite(quest.target) || quest.target <= 0) {
      fail(`Quest "${name}": target must be a positive number`)
    }
    return {
      ...quest,
      id: quest.id || `quest-${crypto.randomUUID().slice(0, 8)}`,
      name,
      emoji: quest.emoji || '🎯',
      description: quest.description ?? '',
      unit: quest.unit ?? '',
    }
  })
}

export function fetchState(): Promise<GameState> {
  return fetchGithubState()
}

export { subscribeStorageStatus }

export interface LogResult {
  entry: LogEntry
  bonus: LogEntry[]
  state: GameState
}

export async function postLog(
  playerId: PlayerId,
  activityId: string,
  quantity: number,
): Promise<LogResult> {
  const id = crypto.randomUUID()
  const timestamp = Date.now()
  const critical = Math.random() < CRIT_CHANCE
  const saved = await mutateGithubState('log activity', (state) => {
    const existing = state.log.find((entry) => entry.id === id)
    if (existing) return { entry: existing, bonus: [] as LogEntry[] }
    const activity = state.activities.find((item) => item.id === activityId)
    const player = state.players.find((item) => item.id === playerId)
    const amount = Number(quantity)
    if (!activity) fail(`Unknown activity "${activityId}"`)
    if (!player) fail(`Unknown player "${playerId}"`)
    if (!Number.isFinite(amount) || amount <= 0) fail('Quantity must be a positive number')
    const basePoints = Math.round(amount * activity.pointsPerUnit)
    const crit = basePoints > 0 && critical
    const entry: LogEntry = {
      id,
      activityId,
      playerId,
      quantity: amount,
      points: crit ? basePoints * 2 : basePoints,
      timestamp,
      ...(crit ? { crit: true } : {}),
    }
    state.log.push(entry)
    return { entry, bonus: evaluateQuests(state, playerId, new Date(timestamp)) }
  })
  return { ...saved.result, state: saved.state }
}

export async function deleteLog(entryId: string): Promise<{ ok: boolean }> {
  await mutateGithubState('remove activity', (state) => {
    const entry = state.log.find((item) => item.id === entryId)
    if (!entry) return
    state.log = state.log.filter((item) => item.id !== entryId)
    if (entry.bookId) {
      const book = state.books.find((item) => item.id === entry.bookId)
      if (book) book.currentPage = Math.max(0, book.currentPage - entry.quantity)
    }
  })
  return { ok: true }
}

export async function putSettings(
  players: [Player, Player],
  activities: Activity[],
  prize: string,
  questPool?: QuestDef[],
): Promise<GameState> {
  const saved = await mutateGithubState('update settings', (state) => {
    if (players.length !== 2) fail('There must be exactly two players')
    state.players = players
    state.activities = activities
    state.prize = prize
    if (questPool) state.questPool = sanitizeQuestPool(questPool)
  })
  return saved.state
}

export async function resetProgress(): Promise<{ ok: boolean }> {
  await mutateGithubState('reset progress', (state) => {
    state.log = []
    for (const book of state.books) book.currentPage = 0
  })
  return { ok: true }
}

export async function createBook(
  title: string,
  totalPages: number,
  startPage = 0,
  activityId?: string,
): Promise<GameState> {
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  const saved = await mutateGithubState('add book', (state) => {
    if (state.books.some((book) => book.id === id)) return
    const cleanTitle = title.trim()
    const pages = Number(totalPages)
    const start = Number(startPage)
    if (!cleanTitle) fail('Title is required')
    if (!Number.isFinite(pages) || pages <= 0) fail('Total pages must be a positive number')
    if (!Number.isFinite(start) || start < 0 || start > pages) {
      fail(`Start page must be between 0 and ${Math.round(pages)}`)
    }
    const activity = activityId
      ? state.activities.find((item) => item.id === activityId)
      : readingActivity(state)
    if (!activity) fail('Add a positive reading activity in Settings first')
    state.books.push({
      id,
      title: cleanTitle,
      totalPages: Math.round(pages),
      currentPage: Math.round(start),
      activityId: activity.id,
      createdAt,
    })
  })
  return saved.state
}

export async function logBookProgress(
  bookId: string,
  playerId: PlayerId,
  page: number,
): Promise<{ state: GameState; entry: LogEntry; bonus: LogEntry[] }> {
  const entryId = crypto.randomUUID()
  const timestamp = Date.now()
  const critical = Math.random() < CRIT_CHANCE
  const saved = await mutateGithubState('log reading progress', (state) => {
    const existing = state.log.find((entry) => entry.id === entryId)
    if (existing) return { entry: existing, bonus: [] as LogEntry[] }
    const book = state.books.find((item) => item.id === bookId)
    const player = state.players.find((item) => item.id === playerId)
    const target = Number(page)
    if (!book) fail('Book not found')
    if (!player) fail(`Unknown player "${playerId}"`)
    if (!Number.isFinite(target)) fail('Page must be a number')
    if (target > book.totalPages) fail(`Page cannot exceed the book's ${book.totalPages} pages`)
    if (target <= book.currentPage) fail(`Page must be beyond the current page (${book.currentPage})`)
    const activity =
      state.activities.find((item) => item.id === book.activityId) ?? readingActivity(state)
    if (!activity) fail('Add a positive reading activity in Settings first')
    const quantity = target - book.currentPage
    const basePoints = Math.round(quantity * activity.pointsPerUnit)
    const crit = basePoints > 0 && critical
    const entry: LogEntry = {
      id: entryId,
      activityId: activity.id,
      playerId,
      quantity,
      points: crit ? basePoints * 2 : basePoints,
      timestamp,
      bookId,
      ...(crit ? { crit: true } : {}),
    }
    book.currentPage = target
    state.log.push(entry)
    return { entry, bonus: evaluateQuests(state, playerId, new Date(timestamp)) }
  })
  return { ...saved.result, state: saved.state }
}

export async function updateBook(bookId: string, patch: Partial<Book>): Promise<GameState> {
  const saved = await mutateGithubState('update book', (state) => {
    const book = state.books.find((item) => item.id === bookId)
    if (!book) fail('Book not found')
    if (patch.title !== undefined) {
      const title = patch.title.trim()
      if (!title) fail('Title must not be empty')
      book.title = title
    }
    if (patch.totalPages !== undefined) {
      if (!Number.isFinite(patch.totalPages) || patch.totalPages <= 0) {
        fail('Total pages must be a positive number')
      }
      book.totalPages = Math.round(patch.totalPages)
      book.currentPage = Math.min(book.currentPage, book.totalPages)
    }
    if (patch.currentPage !== undefined) {
      if (!Number.isFinite(patch.currentPage) || patch.currentPage < 0) {
        fail('Current page must be zero or more')
      }
      book.currentPage = Math.min(Math.round(patch.currentPage), book.totalPages)
    }
  })
  return saved.state
}

export async function deleteBook(bookId: string): Promise<GameState> {
  const saved = await mutateGithubState('remove book', (state) => {
    state.books = state.books.filter((book) => book.id !== bookId)
  })
  return saved.state
}
