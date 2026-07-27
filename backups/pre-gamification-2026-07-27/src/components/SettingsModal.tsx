import { useState } from 'react'
import type { Activity, GameState } from '../types'

interface Props {
  state: GameState
  onSave: (next: GameState) => void
  onResetProgress: () => void
  onClose: () => void
}

export function SettingsModal({ state, onSave, onResetProgress, onClose }: Props) {
  const [players, setPlayers] = useState(state.players)
  const [activities, setActivities] = useState<Activity[]>(state.activities)
  const [prize, setPrize] = useState(state.prize ?? '')

  function updateActivity(index: number, patch: Partial<Activity>) {
    setActivities((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  function removeActivity(index: number) {
    setActivities((prev) => prev.filter((_, i) => i !== index))
  }

  function addActivity(penalty: boolean) {
    setActivities((prev) => [
      ...prev,
      {
        id: `custom-${crypto.randomUUID().slice(0, 8)}`,
        name: penalty ? 'New penalty' : 'New activity',
        emoji: penalty ? '⚠️' : '⭐',
        unit: penalty ? 'times' : 'min',
        pointsPerUnit: penalty ? -5 : 0.5,
        target: penalty ? 0 : 100,
      },
    ])
  }

  function handleSave() {
    onSave({ ...state, players, activities, prize })
    onClose()
  }

  const positives = activities.map((a, i) => [a, i] as const).filter(([a]) => a.pointsPerUnit >= 0)
  const penalties = activities.map((a, i) => [a, i] as const).filter(([a]) => a.pointsPerUnit < 0)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>⚙️ Settings</h2>

        <h3>Players</h3>
        <div className="settings-players">
          {players.map((p, i) => (
            <div key={p.id} className="settings-player-row">
              <input
                className="input-emoji"
                value={p.avatar}
                onChange={(e) =>
                  setPlayers(
                    (prev) =>
                      prev.map((pl, j) => (j === i ? { ...pl, avatar: e.target.value } : pl)) as [
                        typeof prev[0],
                        typeof prev[1],
                      ],
                  )
                }
              />
              <input
                className="input-name"
                value={p.name}
                onChange={(e) =>
                  setPlayers(
                    (prev) =>
                      prev.map((pl, j) => (j === i ? { ...pl, name: e.target.value } : pl)) as [
                        typeof prev[0],
                        typeof prev[1],
                      ],
                  )
                }
              />
            </div>
          ))}
        </div>

        <h3>Prize</h3>
        <input
          className="input-prize"
          value={prize}
          placeholder="What do you win when you reach the goal?"
          onChange={(e) => setPrize(e.target.value)}
        />

        <h3>Activities (earn points)</h3>
        <div className="settings-activity-header">
          <span>Emoji</span>
          <span>Name</span>
          <span>Pts/unit</span>
          <span>Unit</span>
          <span>Target</span>
          <span />
        </div>
        {positives.map(([a, i]) => (
          <div key={a.id} className="settings-activity-row">
            <input
              className="input-emoji"
              value={a.emoji}
              onChange={(e) => updateActivity(i, { emoji: e.target.value })}
            />
            <input
              className="input-name"
              value={a.name}
              onChange={(e) => updateActivity(i, { name: e.target.value })}
            />
            <input
              className="input-number"
              type="number"
              step="0.1"
              value={a.pointsPerUnit}
              onChange={(e) => updateActivity(i, { pointsPerUnit: Number(e.target.value) })}
            />
            <input
              className="input-unit"
              value={a.unit}
              onChange={(e) => updateActivity(i, { unit: e.target.value })}
            />
            <input
              className="input-number"
              type="number"
              value={a.target}
              onChange={(e) => updateActivity(i, { target: Number(e.target.value) })}
            />
            <button className="btn-remove" onClick={() => removeActivity(i)}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn-secondary" onClick={() => addActivity(false)}>
          + Add activity
        </button>

        <h3>Penalties (lose points)</h3>
        {penalties.map(([a, i]) => (
          <div key={a.id} className="settings-activity-row">
            <input
              className="input-emoji"
              value={a.emoji}
              onChange={(e) => updateActivity(i, { emoji: e.target.value })}
            />
            <input
              className="input-name"
              value={a.name}
              onChange={(e) => updateActivity(i, { name: e.target.value })}
            />
            <input
              className="input-number"
              type="number"
              step="0.1"
              value={a.pointsPerUnit}
              onChange={(e) => updateActivity(i, { pointsPerUnit: Number(e.target.value) })}
            />
            <input
              className="input-unit"
              value={a.unit}
              onChange={(e) => updateActivity(i, { unit: e.target.value })}
            />
            <span className="settings-spacer" />
            <button className="btn-remove" onClick={() => removeActivity(i)}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn-secondary" onClick={() => addActivity(true)}>
          + Add penalty
        </button>

        <p className="settings-note">
          Points = quantity × points per unit (e.g. 30 min of exercise at 0.5 pts/min = 15 pts).
          The team goal is the sum of all activity targets. Past entries keep the points they were
          logged with.
        </p>

        <div className="modal-actions">
          <button
            className="btn-danger"
            onClick={() => {
              if (window.confirm('Reset all logged points and history? This cannot be undone.')) {
                onResetProgress()
                onClose()
              }
            }}
          >
            Reset progress
          </button>
          <div className="modal-actions-right">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
