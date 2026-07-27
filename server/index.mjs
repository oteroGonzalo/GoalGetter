import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, 'data.json')
const PORT = Number(process.env.PORT) || 3001

function defaultState() {
  return {
    players: [
      { id: 'p1', name: 'Player 1', avatar: '🦊' },
      { id: 'p2', name: 'Player 2', avatar: '🐼' },
    ],
    activities: [
      { id: 'exercise', name: 'Exercise', emoji: '🏋️', unit: 'min', pointsPerUnit: 0.5, target: 400 },
      { id: 'reading', name: 'Reading', emoji: '📚', unit: 'pages', pointsPerUnit: 0.5, target: 200 },
      { id: 'alcohol', name: 'Alcohol', emoji: '🍺', unit: 'drinks', pointsPerUnit: -4, target: 0 },
      { id: 'eating-out', name: 'Eating out', emoji: '🍔', unit: 'times', pointsPerUnit: -5, target: 0 },
    ],
    log: [],
    books: [],
    prize: '🏝️ A long weekend getaway',
  }
}

/** Pick the activity book progress should credit: an id "reading", else the first
 * positive activity measured in pages, else the first positive activity. */
function defaultReadingActivity() {
  return (
    state.activities.find((a) => a.id === 'reading') ??
    state.activities.find((a) => a.pointsPerUnit >= 0 && /page/i.test(a.unit)) ??
    state.activities.find((a) => a.pointsPerUnit >= 0)
  )
}

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    if (parsed.players && parsed.activities && parsed.log) {
      if (typeof parsed.prize !== 'string') parsed.prize = defaultState().prize
      if (!Array.isArray(parsed.books)) parsed.books = []
      return parsed
    }
  } catch {
    // missing or corrupt file → start fresh
  }
  return defaultState()
}

function saveState() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2))
}

let state = loadState()
saveState()

const app = express()
app.use(express.json())

// CORS so scripts, phones or other devices can call the API directly.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

/** Full state: players, activities and the complete log. */
app.get('/api/state', (_req, res) => {
  res.json(state)
})

/**
 * Log an activity.
 * Body: { "playerId": "p1" | "p2", "activityId": "exercise", "quantity": 30 }
 * Points = round(quantity × the activity's pointsPerUnit).
 */
app.post('/api/log', (req, res) => {
  const { playerId, activityId, quantity } = req.body ?? {}
  const activity = state.activities.find((a) => a.id === activityId)
  const player = state.players.find((p) => p.id === playerId)
  const qty = Number(quantity)
  if (!activity) return res.status(400).json({ error: `Unknown activityId "${activityId}"` })
  if (!player) return res.status(400).json({ error: `Unknown playerId "${playerId}" (use p1 or p2)` })
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'quantity must be a positive number' })
  }
  const entry = {
    id: crypto.randomUUID(),
    activityId,
    playerId,
    quantity: qty,
    points: Math.round(qty * activity.pointsPerUnit),
    timestamp: Date.now(),
  }
  state.log.push(entry)
  saveState()
  res.status(201).json(entry)
})

/** Undo a log entry by id. If it came from a book, rewind that book's page too. */
app.delete('/api/log/:id', (req, res) => {
  const entry = state.log.find((e) => e.id === req.params.id)
  if (!entry) return res.status(404).json({ error: 'Entry not found' })
  state.log = state.log.filter((e) => e.id !== entry.id)
  if (entry.bookId) {
    const book = state.books.find((b) => b.id === entry.bookId)
    if (book) book.currentPage = Math.max(0, book.currentPage - entry.quantity)
  }
  saveState()
  res.json({ ok: true })
})

/** Replace players, activities and/or prize (used by the Settings screen). */
app.put('/api/settings', (req, res) => {
  const { players, activities, prize } = req.body ?? {}
  if (prize !== undefined) {
    if (typeof prize !== 'string') {
      return res.status(400).json({ error: 'prize must be a string' })
    }
    state.prize = prize
  }
  if (players !== undefined) {
    if (!Array.isArray(players) || players.length !== 2) {
      return res.status(400).json({ error: 'players must be an array of exactly 2 players' })
    }
    state.players = players
  }
  if (activities !== undefined) {
    if (!Array.isArray(activities)) {
      return res.status(400).json({ error: 'activities must be an array' })
    }
    state.activities = activities
  }
  saveState()
  res.json(state)
})

/**
 * Add a book to the reading list.
 * Body: { "title": "Dune", "totalPages": 412, "activityId"?: "reading" }
 */
app.post('/api/books', (req, res) => {
  const { title, totalPages, activityId, startPage } = req.body ?? {}
  const pages = Number(totalPages)
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' })
  }
  if (!Number.isFinite(pages) || pages <= 0) {
    return res.status(400).json({ error: 'totalPages must be a positive number' })
  }
  // Pages already read before tracking started — skipped, not scored.
  const start = startPage === undefined ? 0 : Number(startPage)
  if (!Number.isFinite(start) || start < 0 || start > pages) {
    return res.status(400).json({ error: `startPage must be between 0 and ${Math.round(pages)}` })
  }
  const activity = activityId
    ? state.activities.find((a) => a.id === activityId)
    : defaultReadingActivity()
  if (!activity) {
    return res.status(400).json({ error: 'No reading activity to credit — add one in Settings first' })
  }
  const book = {
    id: crypto.randomUUID(),
    title: title.trim(),
    totalPages: Math.round(pages),
    currentPage: Math.round(start),
    activityId: activity.id,
    createdAt: Date.now(),
  }
  state.books.push(book)
  saveState()
  res.status(201).json(state)
})

/**
 * Log today's reading progress on a book.
 * Body: { "playerId": "p1", "page": 120 }
 * Pages read = page − the book's current page; those pages are logged as reading points.
 */
app.post('/api/books/:id/progress', (req, res) => {
  const { playerId, page } = req.body ?? {}
  const book = state.books.find((b) => b.id === req.params.id)
  const player = state.players.find((p) => p.id === playerId)
  const target = Number(page)
  if (!book) return res.status(404).json({ error: 'Book not found' })
  if (!player) return res.status(400).json({ error: `Unknown playerId "${playerId}" (use p1 or p2)` })
  if (!Number.isFinite(target)) return res.status(400).json({ error: 'page must be a number' })
  if (target > book.totalPages) {
    return res.status(400).json({ error: `page can't exceed the book's ${book.totalPages} pages` })
  }
  if (target <= book.currentPage) {
    return res.status(400).json({
      error: `page must be beyond the current page (${book.currentPage})`,
    })
  }
  const activity =
    state.activities.find((a) => a.id === book.activityId) ?? defaultReadingActivity()
  if (!activity) {
    return res.status(400).json({ error: 'No reading activity to credit — add one in Settings first' })
  }
  const pagesRead = target - book.currentPage
  const entry = {
    id: crypto.randomUUID(),
    activityId: activity.id,
    playerId,
    quantity: pagesRead,
    points: Math.round(pagesRead * activity.pointsPerUnit),
    timestamp: Date.now(),
    bookId: book.id,
  }
  book.currentPage = target
  state.log.push(entry)
  saveState()
  res.status(201).json({ state, entry })
})

/** Edit a book's title, total pages, or correct its current page. */
app.put('/api/books/:id', (req, res) => {
  const book = state.books.find((b) => b.id === req.params.id)
  if (!book) return res.status(404).json({ error: 'Book not found' })
  const { title, totalPages, currentPage } = req.body ?? {}
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title must be a non-empty string' })
    }
    book.title = title.trim()
  }
  if (totalPages !== undefined) {
    const pages = Number(totalPages)
    if (!Number.isFinite(pages) || pages <= 0) {
      return res.status(400).json({ error: 'totalPages must be a positive number' })
    }
    book.totalPages = Math.round(pages)
  }
  if (currentPage !== undefined) {
    const cp = Number(currentPage)
    if (!Number.isFinite(cp) || cp < 0) {
      return res.status(400).json({ error: 'currentPage must be zero or more' })
    }
    book.currentPage = Math.min(Math.round(cp), book.totalPages)
  }
  saveState()
  res.json(state)
})

/** Remove a book. Existing reading points already logged from it are kept. */
app.delete('/api/books/:id', (req, res) => {
  const before = state.books.length
  state.books = state.books.filter((b) => b.id !== req.params.id)
  if (state.books.length === before) return res.status(404).json({ error: 'Book not found' })
  saveState()
  res.json(state)
})

/** Clear the whole log (progress reset). */
app.post('/api/reset', (_req, res) => {
  state.log = []
  for (const book of state.books) book.currentPage = 0
  saveState()
  res.json({ ok: true })
})

// In production, serve the built frontend from dist/ so one process runs everything.
const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`GoalGetter API listening on http://localhost:${PORT}`)
})
