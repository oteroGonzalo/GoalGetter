import type { Activity, LogEntry, Player } from '../types'
import { Heatmap } from './Heatmap'

interface Props {
  player: Player
  score: number
  streak: number
  isLeader: boolean
  log: LogEntry[]
  activities: Activity[]
}

export function PlayerCard({ player, score, streak, isLeader, log, activities }: Props) {
  return (
    <div className={`player-card ${isLeader ? 'leader' : ''}`}>
      {isLeader && <div className="crown">👑</div>}
      <div className="player-avatar">{player.avatar}</div>
      <div className="player-name">{player.name}</div>
      <div className="player-score">{score} pts</div>
      <div className={`player-streak ${streak > 0 ? 'hot' : ''}`}>
        🔥 {streak}-day streak
      </div>
      <Heatmap log={log} playerId={player.id} activities={activities} />
    </div>
  )
}
