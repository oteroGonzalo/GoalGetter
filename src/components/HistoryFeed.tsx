import type { Activity, GameState, LogEntry } from '../types'

interface Props {
  state: GameState
  onUndo: (entryId: string) => void
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Today ${time}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

export function HistoryFeed({ state, onUndo }: Props) {
  const activityById = new Map<string, Activity>(state.activities.map((a) => [a.id, a]))
  const playerById = new Map(state.players.map((p) => [p.id, p]))
  const bookById = new Map(state.books.map((b) => [b.id, b]))
  const recent: LogEntry[] = [...state.log].sort((a, b) => b.timestamp - a.timestamp).slice(0, 25)

  if (recent.length === 0) {
    return (
      <div className="feed-empty">
        No activity yet — log your first one and start the quest! 🚀
      </div>
    )
  }

  return (
    <ul className="feed">
      {recent.map((entry) => {
        const activity = activityById.get(entry.activityId)
        const player = playerById.get(entry.playerId)
        const book = entry.bookId ? bookById.get(entry.bookId) : undefined
        return (
          <li key={entry.id} className="feed-item">
            <span className="feed-avatar">{player?.avatar ?? '❓'}</span>
            <span className="feed-text">
              <strong>{player?.name ?? 'Unknown'}</strong>{' '}
              {entry.questId
                ? `${entry.questEmoji ?? '🎁'} Daily quest: ${entry.questName ?? 'Bonus'}`
                : book
                  ? `📖 ${book.title}`
                  : activity
                    ? `${activity.emoji} ${activity.name}`
                    : 'a deleted activity'}
              {activity && (
                <span className="feed-qty">
                  {' '}
                  — {entry.quantity} {book ? 'pages' : activity.unit}
                </span>
              )}
              {entry.crit && <span className="feed-crit"> 💥 CRIT ×2</span>}
            </span>
            <span
              className={`feed-points ${entry.questId ? 'bonus' : entry.points >= 0 ? 'pos' : 'neg'}`}
            >
              {entry.points > 0 ? `+${entry.points}` : entry.points}
            </span>
            <span className="feed-time">{formatTime(entry.timestamp)}</span>
            <button className="feed-undo" onClick={() => onUndo(entry.id)} title="Undo this entry">
              ✕
            </button>
          </li>
        )
      })}
    </ul>
  )
}
