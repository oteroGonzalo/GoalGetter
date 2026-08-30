import { useEffect, useRef, useState } from 'react'
import { catSheet, type PetAnimation, type PetType } from '../spriteConfig'
import { useSpriteImage } from '../hooks/useSpriteImage'

export interface PetState {
  petType: PetType
  happiness: number // 0-100
  lastPetted: string // ISO date (YYYY-MM-DD)
  totalPets: number
  streak: number // consecutive days petted
}

interface Props {
  petState: PetState
  onPet: () => Promise<void> | void
}

const SCALE = 3
const FRAME_W = catSheet.frameWidth * SCALE
const FRAME_H = catSheet.frameHeight * SCALE
const SHEET_W = catSheet.columns * FRAME_W
const SHEET_H = catSheet.rows * FRAME_H
// The cat art only fills part of each 32x32 frame; the clickable hitbox
// covers just the body (bottom-center of the frame), not the empty air.
const HITBOX_W = Math.round(FRAME_W * 0.6)
const HITBOX_H = Math.round(FRAME_H * 0.65)
const EDGE = 10 // margin from viewport edges
const WALK_SPEED = 0.7 // px per tick (~60fps)
const RUN_SPEED = 2.6
const HEART_MS = 1100

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * The resident cat. It lives along the bottom edge of the site: wanders
 * around, sits, grooms, naps — and wants to be petted once a day, Stardew
 * Valley style. An ❗ hovers over it until it has been petted today;
 * petting pops a ❤️ above its head (or a 💧 if it is heartbroken).
 * A neglected cat (low happiness) turns gray and mostly sleeps; at 0 it
 * only sleeps and cries when touched.
 */
export function DailyPet({ petState, onPet }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
  const happyTrigger = useRef<() => void>(() => {})
  const happinessRef = useRef(petState.happiness)
  happinessRef.current = petState.happiness

  const [petting, setPetting] = useState(false)
  const [heart, setHeart] = useState<{ key: number; emoji: string } | null>(null)
  const heartTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(heartTimer.current), [])

  const { image, error } = useSpriteImage(catSheet.sheetUrl)

  const alreadyPettedToday = petState.lastPetted === todayISO()
  const isSad = petState.happiness <= 0 // heartbroken: sleeps all day, cries instead of loving

  // Behavior loop: a tiny state machine driven by requestAnimationFrame.
  // Position/frame live in locals (not React state) so the 60fps updates
  // don't re-render; styles are written imperatively.
  useEffect(() => {
    if (!wrapRef.current || !spriteRef.current || !image) return
    const wrap: HTMLDivElement = wrapRef.current
    const sprite: HTMLDivElement = spriteRef.current

    let raf = 0
    let anim: PetAnimation = happinessRef.current <= 0 ? 'sleep' : 'sit'
    let frame = 0
    let lastFrameAt = 0
    let x = 40
    let dir: 1 | -1 = 1
    let targetX = x
    let nextDecisionAt = performance.now() + 2500

    const maxX = () => Math.max(EDGE, window.innerWidth - FRAME_W - EDGE)

    function setAnim(next: PetAnimation) {
      anim = next
      frame = 0
      lastFrameAt = 0
    }

    function decide(now: number) {
      if (happinessRef.current <= 0) {
        // Heartbroken: too sad to do anything but sleep.
        setAnim('sleep')
        nextDecisionAt = now + 8000
        return
      }
      if (anim === 'walk' || anim === 'run') {
        // Arrived somewhere: sit down for a bit.
        setAnim('sit')
        nextDecisionAt = now + 2500 + Math.random() * 3000
        return
      }
      const sleepy = happinessRef.current < 40 // neglected cats mostly nap
      const roll = Math.random()
      if (roll < (sleepy ? 0.6 : 0.2)) {
        setAnim('sleep')
        nextDecisionAt = now + 7000 + Math.random() * 9000
      } else if (roll < (sleepy ? 0.75 : 0.4)) {
        setAnim('groom')
        nextDecisionAt = now + 2500 + Math.random() * 2500
      } else if (roll < 0.9) {
        targetX = EDGE + Math.random() * (maxX() - EDGE)
        dir = targetX > x ? 1 : -1
        setAnim(Math.random() < 0.15 ? 'run' : 'walk') // occasional zoomies
        nextDecisionAt = now + 60_000 // ends on arrival instead
      } else {
        setAnim('sit')
        nextDecisionAt = now + 2000 + Math.random() * 3000
      }
    }

    // Called from the click handler: joyful pounce, then back to normal life.
    happyTrigger.current = () => {
      setAnim('jump')
      nextDecisionAt = performance.now() + 60_000
    }

    function step(now: number) {
      const spec = catSheet.animations[anim]

      // Advance the animation frame
      if (!lastFrameAt) lastFrameAt = now
      if (now - lastFrameAt >= spec.frameDuration) {
        lastFrameAt = now
        if (frame + 1 >= spec.frames) {
          if (spec.loop) {
            frame = 0
          } else {
            // One-shot (jump) finished
            setAnim('sit')
            nextDecisionAt = now + 1500 + Math.random() * 2000
          }
        } else {
          frame++
        }
      }

      // Move while walking/running
      if (anim === 'walk' || anim === 'run') {
        x += dir * (anim === 'run' ? RUN_SPEED : WALK_SPEED)
        const arrived = dir === 1 ? x >= targetX : x <= targetX
        if (arrived || x <= EDGE || x >= maxX()) {
          x = Math.min(Math.max(x, EDGE), maxX())
          decide(now)
        }
      } else if (now >= nextDecisionAt) {
        decide(now)
      }

      const row = catSheet.animations[anim].row
      sprite.style.backgroundPosition = `${-frame * FRAME_W}px ${-row * FRAME_H}px`
      sprite.style.transform = `scaleX(${dir})` // art faces right; flip to walk left
      wrap.style.transform = `translateX(${x}px)`
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [image])

  if (!image || error) {
    if (error) console.error(error)
    return null
  }

  function popHeart(emoji: string) {
    setHeart((prev) => ({ key: (prev?.key ?? 0) + 1, emoji }))
    window.clearTimeout(heartTimer.current)
    heartTimer.current = window.setTimeout(() => setHeart(null), HEART_MS)
  }

  async function handlePet() {
    if (petting) return
    const sad = petState.happiness <= 0
    if (!sad) happyTrigger.current() // a heartbroken cat is too sad to pounce
    popHeart(sad ? '💧' : '❤️')
    if (alreadyPettedToday) return // just the little heart, no state change
    setPetting(true)
    try {
      await onPet()
    } finally {
      setPetting(false)
    }
  }

  return (
    <div ref={wrapRef} className="daily-pet">
      {heart && (
        <div key={heart.key} className="daily-pet-heart" aria-hidden="true">
          {heart.emoji}
        </div>
      )}
      {!alreadyPettedToday && (
        <div className="daily-pet-alert">{isSad ? '💧' : '❗'}</div>
      )}
      <div ref={spriteRef} className="daily-pet-sprite" />
      <button
        className="daily-pet-hitbox"
        onClick={handlePet}
        aria-label="Pet the cat"
        title={alreadyPettedToday ? 'Already loved today' : 'Pet the cat!'}
      />

      <style>{`
        .daily-pet {
          position: fixed;
          left: 0;
          bottom: 0;
          z-index: 40;
          display: flex;
          flex-direction: column;
          align-items: center;
          will-change: transform;
        }
        .daily-pet-sprite {
          width: ${FRAME_W}px;
          height: ${FRAME_H}px;
          background: transparent url('${catSheet.sheetUrl}') 0 0 no-repeat;
          background-size: ${SHEET_W}px ${SHEET_H}px;
          image-rendering: pixelated;
          pointer-events: none;
          filter: saturate(${petState.happiness < 40 ? 0.45 : 1});
          transition: filter 0.4s ease;
        }
        .daily-pet-hitbox {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: ${HITBOX_W}px;
          height: ${HITBOX_H}px;
          padding: 0;
          border: none;
          background: transparent;
          cursor: pointer;
        }
        .daily-pet:has(.daily-pet-hitbox:hover) .daily-pet-sprite {
          filter: saturate(${petState.happiness < 40 ? 0.6 : 1.15}) brightness(1.05);
        }
        .daily-pet-heart {
          position: absolute;
          bottom: calc(100% - 4px);
          left: 50%;
          font-size: 30px;
          line-height: 1;
          pointer-events: none;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
          animation: daily-pet-heart-float ${HEART_MS}ms ease-out forwards;
        }
        @keyframes daily-pet-heart-float {
          0% { transform: translate(-50%, 14px) scale(0.3); opacity: 0; }
          25% { transform: translate(-50%, -4px) scale(1.3); opacity: 1; }
          60% { transform: translate(-50%, -18px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -44px) scale(0.9); opacity: 0; }
        }
        .daily-pet-alert {
          font-size: 18px;
          line-height: 1;
          margin-bottom: 2px;
          animation: daily-pet-hop 1.1s ease-in-out infinite;
          pointer-events: none;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }
        @keyframes daily-pet-hop {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  )
}
