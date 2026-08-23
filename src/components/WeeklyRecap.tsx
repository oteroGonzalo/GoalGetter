import type { GameState, PlayerId } from '../types'

interface Props {
  state: GameState
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Compact "this week vs last week" card with the weekly MVP. */
export function WeeklyRecap({ state }: Props) {
  const now = Date.now()
  const thisWeek = state.log.filter((e) => e.timestamp >= now - WEEK_MS)
  const lastWeek = state.log.filter(
    (e) => e.timestamp >= now - 2 * WEEK_MS && e.timestamp < now - WEEK_MS,
  )
  if (thisWeek.length === 0 && lastWeek.length === 0) return null

  const thisPts = thisWeek.reduce((s, e) => s + e.points, 0)
  const lastPts = lastWeek.reduce((s, e) => s + e.points, 0)

  const byPlayer: Record<PlayerId, number> = { p1: 0, p2: 0 }
  for (const e of thisWeek) if (e.points > 0) byPlayer[e.playerId] += e.points
  const mvp =
    byPlayer.p1 === byPlayer.p2
      ? null
      : state.players.find((p) => p.id === (byPlayer.p1 > byPlayer.p2 ? 'p1' : 'p2'))

  const delta = lastPts !== 0 ? Math.round(((thisPts - lastPts) / Math.abs(lastPts)) * 100) : null

  return (
    <div className="recap-card">
      <div className="recap-label">📅 This week</div>
      <div className="recap-text">
        <strong>{thisPts} pts</strong>
        {delta !== null && (
          <span className={`recap-delta ${delta >= 0 ? 'up' : 'down'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs last week
          </span>
        )}
      </div>
      {mvp && (
        <div className="recap-mvp">
          MVP: {mvp.avatar} <strong>{mvp.name}</strong> ({byPlayer[mvp.id]} pts)
        </div>
      )}
    </div>
  )
}
