import { useState } from 'react'
import type { Activity, Player, PlayerId } from '../types'

interface Props {
  activity: Activity
  earned: number
  players: [Player, Player]
  onLog: (activityId: string, playerId: PlayerId, quantity: number) => void
}

export function ActivityCard({ activity, earned, players, onLog }: Props) {
  const [qtyText, setQtyText] = useState('')
  const isPenalty = activity.pointsPerUnit < 0
  const pct = activity.target > 0 ? Math.max(0, Math.min(100, (earned / activity.target) * 100)) : 0
  const done = activity.target > 0 && earned >= activity.target

  const quantity = qtyText === '' ? 1 : Number(qtyText)
  const valid = Number.isFinite(quantity) && quantity > 0
  const preview = valid ? Math.round(quantity * activity.pointsPerUnit) : 0

  function handleLog(playerId: PlayerId) {
    if (!valid) return
    onLog(activity.id, playerId, quantity)
    setQtyText('')
  }

  return (
    <div className={`activity-card ${isPenalty ? 'penalty' : ''} ${done ? 'done' : ''}`}>
      <div className="activity-header">
        <span className="activity-emoji">{activity.emoji}</span>
        <span className="activity-name">{activity.name}</span>
        <span className={`activity-points ${isPenalty ? 'neg' : 'pos'}`}>
          {activity.pointsPerUnit > 0 ? '+' : ''}
          {activity.pointsPerUnit} / {activity.unit.replace(/s$/, '')}
        </span>
      </div>
      {!isPenalty && (
        <>
          <div className="activity-bar">
            <div className="activity-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="activity-progress-label">
            {earned} / {activity.target} pts {done && '✅'}
          </div>
        </>
      )}
      <div className="activity-qty-row">
        <input
          className="qty-input"
          type="number"
          min="1"
          placeholder="1"
          value={qtyText}
          onChange={(e) => setQtyText(e.target.value)}
        />
        <span className="qty-unit">{activity.unit}</span>
        <span className={`qty-preview ${isPenalty ? 'neg' : 'pos'}`}>
          {valid ? `${preview > 0 ? '+' : ''}${preview} pts` : '—'}
        </span>
      </div>
      <div className="activity-buttons">
        {players.map((p) => (
          <button
            key={p.id}
            className={`log-btn ${isPenalty ? 'log-btn-penalty' : ''}`}
            disabled={!valid}
            onClick={() => handleLog(p.id)}
            title={`${isPenalty ? 'Confess for' : 'Log for'} ${p.name}`}
          >
            {p.avatar} {p.name}
          </button>
        ))}
      </div>
    </div>
  )
}
