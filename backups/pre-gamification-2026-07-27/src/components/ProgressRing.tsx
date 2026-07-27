interface Props {
  pct: number
  total: number
  goal: number
}

export function ProgressRing({ pct, total, goal }: Props) {
  const size = 220
  const stroke = 16
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = circumference * (1 - clamped / 100)
  const remaining = Math.max(0, goal - total)

  return (
    <div className="progress-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff8a3d" />
            <stop offset="55%" stopColor="#f74f8e" />
            <stop offset="100%" stopColor="#8f4bf5" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(143, 75, 245, 0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-fill"
        />
      </svg>
      <div className="ring-center">
        <div className="ring-pct">{Math.floor(clamped)}%</div>
        <div className="ring-points">
          {total} / {goal} pts
        </div>
        <div className="ring-remaining">
          {remaining > 0 ? `${remaining} to go` : 'GOAL REACHED! 🏆'}
        </div>
      </div>
    </div>
  )
}
