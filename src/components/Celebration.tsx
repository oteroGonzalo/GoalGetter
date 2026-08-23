export interface CelebrationEvent {
  id: string
  kind: 'level' | 'achievement' | 'quest' | 'crit'
  emoji: string
  title: string
  subtitle: string
}

interface Props {
  event: CelebrationEvent | null
}

/** Full-screen pop banner for big moments; animates in and out on its own. */
export function Celebration({ event }: Props) {
  if (!event) return null
  return (
    <div className="celebration" key={event.id}>
      <div className={`celebration-card celebration-${event.kind}`}>
        <div className="celebration-emoji">{event.emoji}</div>
        <div className="celebration-title">{event.title}</div>
        <div className="celebration-sub">{event.subtitle}</div>
      </div>
    </div>
  )
}
