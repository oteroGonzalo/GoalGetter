import type { CSSProperties } from 'react'
import type { Player, PlayerId } from '../types'

interface Props {
  players: [Player, Player]
  byPlayer: Record<PlayerId, number>
  goal: number
}

/** Each player races along their lane toward the flag — a lane is half the team goal. */
export function RaceTrack({ players, byPlayer, goal }: Props) {
  if (goal <= 0) return null
  const laneGoal = goal / 2
  return (
    <section className="panel race-panel">
      <h2>
        🏁 Race to the prize <span className="quests-sub">each lane is half the team goal</span>
      </h2>
      {players.map((p) => {
        const pts = Math.max(0, byPlayer[p.id])
        const pct = Math.min(100, (pts / laneGoal) * 100)
        return (
          <div key={p.id} className="race-lane">
            <div className="race-track">
              <div className="race-fill" style={{ width: `${pct}%` }} />
              <span className="race-runner" style={{ '--p': pct } as CSSProperties}>
                {p.avatar}
              </span>
              <span className="race-flag">{pct >= 100 ? '🎁' : '🏁'}</span>
            </div>
            <div className="race-label">
              {p.name} — {pts} / {Math.round(laneGoal)} pts ({Math.floor(pct)}%)
              {pct >= 100 && ' — made it! 🎉'}
            </div>
          </div>
        )
      })}
    </section>
  )
}
