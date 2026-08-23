import type { Quest } from '../types'

interface Props {
  quests: Quest[]
}

export function DailyQuests({ quests }: Props) {
  if (quests.length === 0) return null
  return (
    <section className="panel quests-panel">
      <h2>
        🗺️ Daily quests <span className="quests-sub">3 new challenges every day — bonus points!</span>
      </h2>
      <div className="quests-grid">
        {quests.map((q) => {
          const pct = Math.max(0, Math.min(100, (q.progress / q.target) * 100))
          return (
            <div key={q.id} className={`quest-card ${q.awarded ? 'quest-done' : ''}`}>
              <div className="quest-top">
                <span className="quest-emoji">{q.emoji}</span>
                <span className="quest-name">{q.name}</span>
                <span className="quest-bonus">+{q.bonus} pts</span>
              </div>
              <div className="quest-desc">{q.description}</div>
              <div className="quest-bar">
                <div className="quest-bar-fill" style={{ width: `${q.awarded ? 100 : pct}%` }} />
              </div>
              <div className="quest-progress">
                {q.awarded
                  ? `Complete! +${q.bonus} pts earned 🎉`
                  : `${Math.min(q.progress, q.target)} / ${q.target} ${q.unit}`}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
