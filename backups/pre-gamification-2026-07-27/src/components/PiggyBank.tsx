import { useEffect, useState } from 'react'

export interface CoinBurst {
  id: number
  points: number
}

interface Coin {
  id: string
  left: number
  delay: number
  emoji: string
  flyOut: boolean
}

interface Props {
  total: number
  burst: CoinBurst | null
}

export function PiggyBank({ total, burst }: Props) {
  const [coins, setCoins] = useState<Coin[]>([])
  const [mood, setMood] = useState<'idle' | 'happy' | 'sad'>('idle')

  useEffect(() => {
    if (!burst) return
    const isGood = burst.points >= 0
    const count = Math.min(8, Math.max(2, Math.round(Math.abs(burst.points) / 4) + 1))
    const fresh: Coin[] = Array.from({ length: count }, (_, i) => ({
      id: `${burst.id}-${i}`,
      left: 12 + ((i * 37) % 62),
      delay: i * 90,
      emoji: isGood ? '🪙' : '💸',
      flyOut: !isGood,
    }))
    setCoins((prev) => [...prev.filter((c) => !fresh.some((f) => f.id === c.id)), ...fresh])
    setMood(isGood ? 'happy' : 'sad')
    const clearCoins = window.setTimeout(
      () => setCoins((prev) => prev.filter((c) => !fresh.some((f) => f.id === c.id))),
      1800,
    )
    const clearMood = window.setTimeout(() => setMood('idle'), 1200)
    return () => {
      window.clearTimeout(clearCoins)
      window.clearTimeout(clearMood)
    }
  }, [burst])

  return (
    <div className={`piggy ${mood}`}>
      <div className="piggy-coins">
        {coins.map((c) => (
          <span
            key={c.id}
            className={`coin ${c.flyOut ? 'coin-out' : 'coin-in'}`}
            style={{ left: `${c.left}%`, animationDelay: `${c.delay}ms` }}
          >
            {c.emoji}
          </span>
        ))}
      </div>
      <div className="piggy-body">🐷</div>
      <div className="piggy-balance">{total} pts</div>
    </div>
  )
}
