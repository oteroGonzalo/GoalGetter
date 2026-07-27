import type { Achievement } from '../gamification'

interface Props {
  achievements: Achievement[]
}

export function AchievementsRow({ achievements }: Props) {
  const earnedCount = achievements.filter((a) => a.earned).length
  return (
    <section className="panel">
      <h2>
        🏅 Achievements{' '}
        <span className="achievements-count">
          {earnedCount}/{achievements.length}
        </span>
      </h2>
      <div className="achievements-grid">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`achievement ${a.earned ? 'earned' : 'locked'}`}
            title={a.description}
          >
            <div className="achievement-emoji">{a.earned ? a.emoji : '🔒'}</div>
            <div className="achievement-name">{a.name}</div>
            <div className="achievement-desc">{a.description}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
