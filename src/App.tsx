import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import type { GameState, PlayerId } from './types'
import {
  createBook,
  deleteBook,
  deleteLog,
  fetchState,
  logBookProgress,
  postLog,
  putSettings,
  resetProgress,
} from './api'
import {
  computeAchievements,
  computeForecast,
  computeTotals,
  currentStreak,
  levelInfo,
} from './gamification'
import { ProgressRing } from './components/ProgressRing'
import { PlayerCard } from './components/PlayerCard'
import { ActivityCard } from './components/ActivityCard'
import { HistoryFeed } from './components/HistoryFeed'
import { AchievementsRow } from './components/AchievementsRow'
import { SettingsModal } from './components/SettingsModal'
import { BookShelf } from './components/BookShelf'
import { PiggyBank, type CoinBurst } from './components/PiggyBank'

const MILESTONES = [25, 50, 75, 100]
const POLL_INTERVAL_MS = 5000

export default function App() {
  const [state, setState] = useState<GameState | null>(null)
  const [offline, setOffline] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [burst, setBurst] = useState<CoinBurst | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    fetchState()
      .then((s) => setState(s))
      .catch(() => setOffline(true))
  }, [])

  // Keep both players' screens in sync: refresh from the server periodically.
  useEffect(() => {
    const id = window.setInterval(() => {
      fetchState()
        .then((s) => {
          setState(s)
          setOffline(false)
        })
        .catch(() => setOffline(true))
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  const totals = state ? computeTotals(state) : null

  const prevPct = useRef<number | null>(null)
  useEffect(() => {
    if (!totals) return
    if (prevPct.current !== null) {
      const crossed = MILESTONES.find((m) => prevPct.current! < m && totals.pct >= m)
      if (crossed !== undefined) {
        confetti({
          particleCount: crossed === 100 ? 400 : 150,
          spread: crossed === 100 ? 160 : 90,
          origin: { y: 0.4 },
        })
      }
    }
    prevPct.current = totals.pct
  }, [totals?.pct]) // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(message: string) {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2500)
  }

  async function logActivity(activityId: string, playerId: PlayerId, quantity: number) {
    if (!state) return
    const activity = state.activities.find((a) => a.id === activityId)
    const player = state.players.find((p) => p.id === playerId)
    if (!activity || !player) return
    try {
      const entry = await postLog(playerId, activityId, quantity)
      setState((prev) => (prev ? { ...prev, log: [...prev.log, entry] } : prev))
      setBurst({ id: entry.timestamp, points: entry.points })
      if (entry.points >= 0) {
        showToast(
          `${player.avatar} ${player.name} logged ${quantity} ${activity.unit} — +${entry.points} pts!`,
        )
      } else {
        showToast(
          `${player.avatar} ${player.name} confessed ${quantity} ${activity.unit}... ${entry.points} pts 😅`,
        )
      }
    } catch (err) {
      showToast(`⚠️ ${err instanceof Error ? err.message : 'Could not reach the server'}`)
    }
  }

  async function undoEntry(entryId: string) {
    try {
      await deleteLog(entryId)
      setState((prev) => (prev ? { ...prev, log: prev.log.filter((e) => e.id !== entryId) } : prev))
      showToast('Entry removed ↩️')
    } catch {
      showToast('⚠️ Could not reach the server')
    }
  }

  async function addBook(title: string, totalPages: number, startPage = 0) {
    try {
      const saved = await createBook(title, totalPages, startPage)
      setState(saved)
      showToast(`📖 "${title}" added to the reading list`)
    } catch (err) {
      showToast(`⚠️ ${err instanceof Error ? err.message : 'Could not reach the server'}`)
    }
  }

  async function logBook(bookId: string, playerId: PlayerId, page: number) {
    if (!state) return
    const book = state.books.find((b) => b.id === bookId)
    const player = state.players.find((p) => p.id === playerId)
    try {
      const { state: saved, entry } = await logBookProgress(bookId, playerId, page)
      setState(saved)
      setBurst({ id: entry.timestamp, points: entry.points })
      showToast(
        `${player?.avatar ?? ''} ${player?.name ?? ''} read ${entry.quantity} pages of ${
          book?.title ?? 'a book'
        } — +${entry.points} pts!`,
      )
    } catch (err) {
      showToast(`⚠️ ${err instanceof Error ? err.message : 'Could not reach the server'}`)
    }
  }

  async function removeBook(bookId: string) {
    try {
      const saved = await deleteBook(bookId)
      setState(saved)
      showToast('Book removed 🗑️')
    } catch {
      showToast('⚠️ Could not reach the server')
    }
  }

  async function saveSettings(next: GameState) {
    try {
      const saved = await putSettings(next.players, next.activities, next.prize)
      setState(saved)
      showToast('Settings saved ✅')
    } catch {
      showToast('⚠️ Could not reach the server')
    }
  }

  async function handleReset() {
    try {
      await resetProgress()
      setState((prev) => (prev ? { ...prev, log: [] } : prev))
      showToast('Progress reset 🧹')
    } catch {
      showToast('⚠️ Could not reach the server')
    }
  }

  if (!state || !totals) {
    return (
      <div className="app">
        <div className="loading">
          {offline
            ? '⚠️ Cannot reach the GoalGetter server. Start it with "npm run dev" and refresh.'
            : 'Loading your quest… ⚔️'}
        </div>
      </div>
    )
  }

  const level = levelInfo(totals.total)
  const achievements = computeAchievements(state, totals)
  const forecast = computeForecast(state, totals)
  const streaks: Record<PlayerId, number> = {
    p1: currentStreak(state.log, 'p1'),
    p2: currentStreak(state.log, 'p2'),
  }
  const [p1, p2] = state.players
  const positives = state.activities.filter((a) => a.pointsPerUnit >= 0)
  const penalties = state.activities.filter((a) => a.pointsPerUnit < 0)
  const leader: PlayerId | null =
    totals.byPlayer.p1 === totals.byPlayer.p2 ? null : totals.byPlayer.p1 > totals.byPlayer.p2 ? 'p1' : 'p2'

  return (
    <div className="app">
      <header className="header">
        <h1>
          ⚔️ GoalGetter <span className="subtitle">Duo Quest</span>
        </h1>
        <div className="header-right">
          {offline && <span className="offline-pill">⚠️ offline</span>}
          <button className="btn-secondary" onClick={() => setShowSettings(true)}>
            ⚙️ Settings
          </button>
        </div>
      </header>

      <section className="hero panel">
        <div className="hero-ring">
          <ProgressRing pct={totals.pct} total={totals.total} goal={totals.goal} />
        </div>
        <div className="hero-side">
          <div className="level-badge">
            <div className="level-number">Lv {level.level}</div>
            <div className="level-title">{level.title}</div>
            <div className="level-bar">
              <div
                className="level-bar-fill"
                style={{ width: `${(level.xpInLevel / level.xpPerLevel) * 100}%` }}
              />
            </div>
            <div className="level-xp">
              {level.xpInLevel} / {level.xpPerLevel} XP to next level
            </div>
          </div>
          <div className={`prize-card ${totals.pct >= 100 ? 'won' : ''}`}>
            <div className="prize-label">🎁 The Prize</div>
            <div className="prize-text">{state.prize || 'Set a prize in Settings'}</div>
            <div className="prize-hint">
              {totals.pct >= 100
                ? 'UNLOCKED — go book it! 🎉'
                : `Unlocks at 100% · ${Math.max(0, totals.goal - totals.total)} pts to go`}
            </div>
          </div>
          {totals.total < totals.goal && (
            <div className="forecast-card">
              <div className="forecast-label">🔮 Forecast</div>
              {!forecast ? (
                <div className="forecast-text">Log your first activities to see a projection.</div>
              ) : forecast.daysLeft === null ? (
                <div className="forecast-text">
                  Current pace: {forecast.ratePerDay.toFixed(1)} pts/day — at this rate the goal
                  stays out of reach 😬
                </div>
              ) : (
                <div className="forecast-text">
                  At <strong>{forecast.ratePerDay.toFixed(1)} pts/day</strong> you'll reach the
                  goal in <strong>{forecast.daysLeft} days</strong>
                  {forecast.eta && (
                    <>
                      {' '}
                      — around{' '}
                      <strong>
                        {forecast.eta.toLocaleDateString([], { month: 'long', day: 'numeric' })}
                      </strong>
                    </>
                  )}
                </div>
              )}
              {forecast && forecast.daysLeft !== null && (
                <div className="forecast-hint">based on the last 14 days</div>
              )}
            </div>
          )}
          {totals.penaltyPoints < 0 && (
            <div className="penalty-summary">
              😈 Penalties have cost the team <strong>{-totals.penaltyPoints} pts</strong>
            </div>
          )}
        </div>
      </section>

      <section className="players">
        <PlayerCard
          player={p1}
          score={totals.byPlayer.p1}
          streak={streaks.p1}
          isLeader={leader === 'p1'}
          log={state.log}
          activities={state.activities}
        />
        <div className="vs">VS</div>
        <PlayerCard
          player={p2}
          score={totals.byPlayer.p2}
          streak={streaks.p2}
          isLeader={leader === 'p2'}
          log={state.log}
          activities={state.activities}
        />
      </section>

      <section className="panel">
        <h2>💪 Earn points</h2>
        <div className="activities-grid">
          {positives.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              earned={totals.byActivity[a.id] ?? 0}
              players={state.players}
              onLog={logActivity}
            />
          ))}
        </div>
      </section>

      <BookShelf
        state={state}
        onAddBook={addBook}
        onLogProgress={logBook}
        onRemoveBook={removeBook}
      />

      <section className="panel">
        <h2>😈 Confessions (lose points)</h2>
        <div className="activities-grid">
          {penalties.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              earned={totals.byActivity[a.id] ?? 0}
              players={state.players}
              onLog={logActivity}
            />
          ))}
        </div>
      </section>

      <AchievementsRow achievements={achievements} />

      <section className="panel">
        <h2>📜 Recent activity</h2>
        <HistoryFeed state={state} onUndo={undoEntry} />
      </section>

      <PiggyBank total={totals.total} burst={burst} />

      {toast && <div className="toast">{toast}</div>}

      {showSettings && (
        <SettingsModal
          state={state}
          onSave={saveSettings}
          onResetProgress={handleReset}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
