import { useState } from 'react'
import type { Activity, GameState, QuestDef, QuestMetricKind } from '../types'

const METRIC_LABELS: Record<QuestMetricKind, string> = {
  players: 'Players who log (both = 2)',
  logs: 'Number of logs (team)',
  points: 'Points earned (team)',
  'unit-quantity': 'Quantity of a unit…',
  'before-hour': 'A log before an hour…',
  'points-each': 'Points per player, capped…',
}

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
  const [quests, setQuests] = useState<QuestDef[]>(state.questPool ?? [])

  function updateQuest(index: number, patch: Partial<QuestDef>) {
    setQuests((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function updateQuestMetric(index: number, patch: Partial<QuestDef['metric']>) {
    setQuests((prev) =>
      prev.map((q, i) => (i === index ? { ...q, metric: { ...q.metric, ...patch } } : q)),
    )
  }

  function changeQuestKind(index: number, kind: QuestMetricKind) {
    const defaults: Record<QuestMetricKind, Partial<QuestDef>> = {
      players: { metric: { kind }, target: 2, unit: 'players' },
      logs: { metric: { kind }, unit: 'logs' },
      points: { metric: { kind }, unit: 'pts' },
      'unit-quantity': { metric: { kind, match: 'min' }, unit: 'min' },
      'before-hour': { metric: { kind, hour: 10 }, target: 1, unit: 'early log' },
      'points-each': { metric: { kind, perPlayer: 25 }, target: 50, unit: 'pts' },
    }
    setQuests((prev) => prev.map((q, i) => (i === index ? { ...q, ...defaults[kind] } : q)))
  }

  function removeQuest(index: number) {
    setQuests((prev) => prev.filter((_, i) => i !== index))
  }

  function addQuest() {
    setQuests((prev) => [
      ...prev,
      {
        id: `quest-${crypto.randomUUID().slice(0, 8)}`,
        name: 'New quest',
        emoji: '🎯',
        description: '',
        bonus: 15,
        target: 3,
        unit: 'logs',
        metric: { kind: 'logs' },
      },
    ])
  }

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
    onSave({ ...state, players, activities, prize, questPool: quests })
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

        <h3>Daily quests</h3>
        {quests.map((q, i) => (
          <div key={q.id} className="settings-quest">
            <div className="settings-quest-top">
              <input
                className="input-emoji"
                value={q.emoji}
                onChange={(e) => updateQuest(i, { emoji: e.target.value })}
              />
              <input
                className="input-name"
                value={q.name}
                onChange={(e) => updateQuest(i, { name: e.target.value })}
              />
              <label className="settings-quest-field">
                Bonus
                <input
                  className="input-number"
                  type="number"
                  value={q.bonus}
                  onChange={(e) => updateQuest(i, { bonus: Number(e.target.value) })}
                />
              </label>
              <button className="btn-remove" onClick={() => removeQuest(i)}>
                ✕
              </button>
            </div>
            <div className="settings-quest-rule">
              <select
                value={q.metric.kind}
                onChange={(e) => changeQuestKind(i, e.target.value as QuestMetricKind)}
              >
                {(Object.keys(METRIC_LABELS) as QuestMetricKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {METRIC_LABELS[kind]}
                  </option>
                ))}
              </select>
              {q.metric.kind === 'unit-quantity' && (
                <label className="settings-quest-field">
                  Unit contains
                  <input
                    className="input-unit"
                    value={q.metric.match ?? ''}
                    onChange={(e) =>
                      updateQuestMetric(i, { match: e.target.value })
                    }
                  />
                </label>
              )}
              {q.metric.kind === 'before-hour' && (
                <label className="settings-quest-field">
                  Before hour
                  <input
                    className="input-number"
                    type="number"
                    min={0}
                    max={23}
                    value={q.metric.hour ?? 10}
                    onChange={(e) => updateQuestMetric(i, { hour: Number(e.target.value) })}
                  />
                </label>
              )}
              {q.metric.kind === 'points-each' && (
                <label className="settings-quest-field">
                  Pts each
                  <input
                    className="input-number"
                    type="number"
                    value={q.metric.perPlayer ?? 25}
                    onChange={(e) => updateQuestMetric(i, { perPlayer: Number(e.target.value) })}
                  />
                </label>
              )}
              <label className="settings-quest-field">
                Target
                <input
                  className="input-number"
                  type="number"
                  value={q.target}
                  onChange={(e) => updateQuest(i, { target: Number(e.target.value) })}
                />
              </label>
              <label className="settings-quest-field">
                Shown as
                <input
                  className="input-unit"
                  value={q.unit}
                  onChange={(e) => updateQuest(i, { unit: e.target.value })}
                />
              </label>
            </div>
            <input
              className="settings-quest-desc"
              value={q.description}
              placeholder="Description shown on the quest card"
              onChange={(e) => updateQuest(i, { description: e.target.value })}
            />
          </div>
        ))}
        <button className="btn-secondary" onClick={addQuest}>
          + Add quest
        </button>
        <p className="settings-note">
          Every day 3 quests are drawn from this pool (fewer if the pool is smaller). Progress is
          measured from today&apos;s logs; completing a quest awards its bonus points automatically.
        </p>

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
