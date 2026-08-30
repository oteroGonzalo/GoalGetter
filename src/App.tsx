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
  subscribeStorageStatus,
} from './api'
import {
  computeAchievements,
  computeForecast,
  computeTotals,
  currentStreak,
  levelInfo,
} from './gamification'
import {
  isMuted,
  playAchievement,
  playCoin,
  playCrit,
  playLevelUp,
  playPenalty,
  playQuest,
  setMuted,
} from './sounds'
import { ProgressRing } from './components/ProgressRing'
import { PlayerCard } from './components/PlayerCard'
import { ActivityCard } from './components/ActivityCard'
import { HistoryFeed } from './components/HistoryFeed'
import { AchievementsRow } from './components/AchievementsRow'
import { SettingsModal } from './components/SettingsModal'
import { BookShelf } from './components/BookShelf'
import { PiggyBank, type CoinBurst } from './components/PiggyBank'
import { DailyQuests } from './components/DailyQuests'
import { RaceTrack } from './components/RaceTrack'
import { WeeklyRecap } from './components/WeeklyRecap'
import { Celebration, type CelebrationEvent } from './components/Celebration'
import { DailyPet } from './components/DailyPet'
import { usePetState } from './hooks/usePetState'

const MILESTONES = [25, 50, 75, 100]
const POLL_INTERVAL_MS = 30_000
const CELEBRATION_MS = 2600

export default function App() {
  const { petState, petPet } = usePetState()
  const [state, setState] = useState<GameState | null>(null)
  const [offline, setOffline] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [burst, setBurst] = useState<CoinBurst | null>(null)
  const [muted, setMutedUi] = useState(isMuted())
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const celebrationQueue = useRef<CelebrationEvent[]>([])
  const celebrationTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    return subscribeStorageStatus(setOffline)
  }, [])

  useEffect(() => {
    fetchState()
      .then((s) => {
        setState(s)
      })
      .catch(() => setOffline(true))
  }, [])

  // GitHub is the shared source of truth. Refresh periodically and whenever the
  // tab becomes active so both players converge without excessive API traffic.
  useEffect(() => {
    const refresh = () => {
      fetchState()
        .then((s) => {
          setState(s)
        })
        .catch(() => setOffline(true))
    }
    const id = window.setInterval(refresh, POLL_INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
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

  function pumpCelebrations() {
    if (celebrationTimer.current !== undefined) return
    const next = celebrationQueue.current.shift()
    if (!next) return
    setCelebration(next)
    celebrationTimer.current = window.setTimeout(() => {
      celebrationTimer.current = undefined
      setCelebration(null)
      pumpCelebrations()
    }, CELEBRATION_MS)
  }

  function celebrate(event: Omit<CelebrationEvent, 'id'>) {
    celebrationQueue.current.push({ ...event, id: `${Date.now()}-${Math.random()}` })
    pumpCelebrations()
  }

  // Watch the log for freshly arrived entries (ours or the other player's, via
  // polling) and celebrate crits and completed daily quests exactly once.
  const knownEntryIds = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!state) return
    if (knownEntryIds.current === null) {
      knownEntryIds.current = new Set(state.log.map((e) => e.id))
      return
    }
    const known = knownEntryIds.current
    for (const e of state.log) {
      if (known.has(e.id)) continue
      known.add(e.id)
      if (e.questId) {
        celebrate({
          kind: 'quest',
          emoji: e.questEmoji ?? '🎁',
          title: 'Daily quest complete!',
          subtitle: `${e.questName ?? 'Bonus'} — +${e.points} pts`,
        })
        playQuest()
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 } })
      } else if (e.crit) {
        celebrate({
          kind: 'crit',
          emoji: '💥',
          title: 'CRITICAL HIT!',
          subtitle: `Double points — +${e.points} pts!`,
        })
        playCrit()
        confetti({ particleCount: 120, spread: 100, startVelocity: 45, origin: { y: 0.5 } })
      }
    }
  }, [state?.log]) // eslint-disable-line react-hooks/exhaustive-deps

  // Level-up fanfare (persisted across sessions so reloading doesn't replay it).
  useEffect(() => {
    if (!totals) return
    const info = levelInfo(totals.total)
    const stored = localStorage.getItem('gg-level')
    if (stored === null) {
      localStorage.setItem('gg-level', String(info.level))
      return
    }
    const prev = Number(stored)
    if (info.level > prev) {
      celebrate({
        kind: 'level',
        emoji: '🎖️',
        title: `LEVEL UP! Lv ${info.level}`,
        subtitle: `You are now ${info.title}!`,
      })
      playLevelUp()
      confetti({ particleCount: 220, spread: 120, origin: { y: 0.4 } })
    }
    if (info.level !== prev) localStorage.setItem('gg-level', String(info.level))
  }, [totals?.total]) // eslint-disable-line react-hooks/exhaustive-deps

  // Achievement unlocks — celebrate anything newly earned since we last looked.
  useEffect(() => {
    if (!state || !totals) return
    const earned = computeAchievements(state, totals).filter((a) => a.earned)
    const raw = localStorage.getItem('gg-achievements')
    if (raw === null) {
      localStorage.setItem('gg-achievements', JSON.stringify(earned.map((a) => a.id)))
      return
    }
    let seen: string[] = []
    try {
      seen = JSON.parse(raw)
    } catch {
      // corrupt storage — start over silently
    }
    const seenSet = new Set(seen)
    const fresh = earned.filter((a) => !seenSet.has(a.id))
    if (fresh.length === 0) return
    for (const a of fresh) {
      celebrate({
        kind: 'achievement',
        emoji: a.emoji,
        title: 'Achievement unlocked!',
        subtitle: `${a.name} — ${a.description}`,
      })
      seenSet.add(a.id)
    }
    playAchievement()
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.35 } })
    localStorage.setItem('gg-achievements', JSON.stringify([...seenSet]))
  }, [state, totals]) // eslint-disable-line react-hooks/exhaustive-deps

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
      const { entry, state: fresh } = await postLog(playerId, activityId, quantity)
      setState(fresh)
      setBurst({ id: entry.timestamp, points: entry.points })
      if (entry.points >= 0) {
        if (!entry.crit) playCoin() // a crit brings its own boom via the log watcher
        showToast(
          `${player.avatar} ${player.name} logged ${quantity} ${activity.unit} — +${entry.points} pts!`,
        )
      } else {
        playPenalty()
        showToast(
          `${player.avatar} ${player.name} confessed ${quantity} ${activity.unit}... ${entry.points} pts 😅`,
        )
      }
    } catch (err) {
      showToast(`⚠️ ${err instanceof Error ? err.message : 'Could not sync with GitHub'}`)
    }
  }

  async function undoEntry(entryId: string) {
    try {
      await deleteLog(entryId)
      const fresh = await fetchState().catch(() => null)
      if (fresh) setState(fresh)
      else setState((prev) => (prev ? { ...prev, log: prev.log.filter((e) => e.id !== entryId) } : prev))
      showToast('Entry removed ↩️')
    } catch {
      showToast('⚠️ Could not sync with GitHub')
    }
  }

  async function addBook(title: string, totalPages: number, startPage = 0) {
    try {
      const saved = await createBook(title, totalPages, startPage)
      setState(saved)
      showToast(`📖 "${title}" added to the reading list`)
    } catch (err) {
      showToast(`⚠️ ${err instanceof Error ? err.message : 'Could not sync with GitHub'}`)
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
      if (!entry.crit) playCoin()
      showToast(
        `${player?.avatar ?? ''} ${player?.name ?? ''} read ${entry.quantity} pages of ${
          book?.title ?? 'a book'
        } — +${entry.points} pts!`,
      )
    } catch (err) {
      showToast(`⚠️ ${err instanceof Error ? err.message : 'Could not sync with GitHub'}`)
    }
  }

  async function removeBook(bookId: string) {
    try {
      const saved = await deleteBook(bookId)
      setState(saved)
      showToast('Book removed 🗑️')
    } catch {
      showToast('⚠️ Could not sync with GitHub')
    }
  }

  async function saveSettings(next: GameState) {
    try {
      const saved = await putSettings(next.players, next.activities, next.prize, next.questPool)
      setState(saved)
      showToast('Settings saved ✅')
    } catch {
      showToast('⚠️ Could not sync with GitHub')
    }
  }

  async function handleReset() {
    try {
      await resetProgress()
      const fresh = await fetchState().catch(() => null)
      if (fresh) setState(fresh)
      else setState((prev) => (prev ? { ...prev, log: [] } : prev))
      showToast('Progress reset 🧹')
    } catch {
      showToast('⚠️ Could not sync with GitHub')
    }
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setMutedUi(next)
  }

  if (!state || !totals) {
    return (
      <div className="app">
        <div className="loading">
          {offline
            ? '⚠️ Cannot reach GitHub and no saved copy is available yet.'
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
          {offline && <span className="offline-pill">⚠️ cached copy</span>}
          <button
            className="btn-secondary btn-sound"
            onClick={toggleMute}
            title={muted ? 'Unmute game sounds' : 'Mute game sounds'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="btn-secondary" onClick={() => setShowSettings(true)}>
            ⚙️ Settings
          </button>
        </div>
      </header>

      <DailyPet petState={petState} onPet={petPet} />

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
          <WeeklyRecap state={state} />
          {totals.penaltyPoints < 0 && (
            <div className="penalty-summary">
              😈 Penalties have cost the team <strong>{-totals.penaltyPoints} pts</strong>
            </div>
          )}
        </div>
      </section>

      <DailyQuests quests={state.quests ?? []} />

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

      <RaceTrack players={state.players} byPlayer={totals.byPlayer} goal={totals.goal} />

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

      <Celebration event={celebration} />

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
