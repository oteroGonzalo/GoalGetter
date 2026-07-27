import type { Activity, LogEntry, PlayerId } from '../types'
import { dayKey } from '../gamification'

interface Props {
  log: LogEntry[]
  playerId: PlayerId
  activities: Activity[]
  weeks?: number
}

interface DayInfo {
  points: number
  done: Set<string>
}

interface Cell {
  key: string
  className: string
  label: string
}

export function Heatmap({ log, playerId, activities, weeks = 12 }: Props) {
  const positiveIds = new Set(activities.filter((a) => a.pointsPerUnit > 0).map((a) => a.id))
  const taskCount = positiveIds.size

  const byDay = new Map<string, DayInfo>()
  for (const e of log) {
    if (e.playerId !== playerId) continue
    const key = dayKey(new Date(e.timestamp))
    const info = byDay.get(key) ?? { points: 0, done: new Set<string>() }
    info.points += e.points
    if (positiveIds.has(e.activityId)) info.done.add(e.activityId)
    byDay.set(key, info)
  }

  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(end.getDate() - (weeks * 7 - 1))
  start.setDate(start.getDate() - start.getDay()) // align first column to Sunday

  const cells: Cell[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = dayKey(cursor)
    const info = byDay.get(key) ?? { points: 0, done: new Set<string>() }
    // Shade by how many of the possible tasks were done that day:
    // light for a fraction, darkest when every task was completed.
    let className = 'l0'
    if (info.points < 0) {
      className = 'neg'
    } else if (info.done.size > 0 && taskCount > 0) {
      className = `l${Math.min(4, Math.max(1, Math.ceil((info.done.size / taskCount) * 4)))}`
    }
    cells.push({
      key,
      className,
      label: `${cursor.toLocaleDateString([], { month: 'short', day: 'numeric' })}: ${info.done.size}/${taskCount} tasks, ${info.points} pts`,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return (
    <div className="heatmap" title={`Tasks completed per day, last ${weeks} weeks`}>
      <div className="heatmap-grid">
        {cells.map((c) => (
          <div key={c.key} className={`heatmap-cell ${c.className}`} title={c.label} />
        ))}
      </div>
      <div className="heatmap-caption">last {weeks} weeks · darker = more tasks done</div>
    </div>
  )
}
