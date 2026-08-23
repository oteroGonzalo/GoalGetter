/**
 * Tiny WebAudio synth for game sounds — no audio assets needed.
 * Sounds are short, quiet and skippable via the mute toggle (persisted).
 */

const MUTE_KEY = 'gg-muted'
let muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'
let ctx: AudioContext | null = null

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean) {
  muted = value
  localStorage.setItem(MUTE_KEY, value ? '1' : '0')
}

function audio(): AudioContext | null {
  if (muted) return null
  try {
    ctx ??= new AudioContext()
    // Browsers may keep the context suspended until a user gesture; try anyway.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

interface ToneOpts {
  /** Seconds after "now" to start. */
  at?: number
  dur?: number
  type?: OscillatorType
  vol?: number
  /** Slide the pitch to this frequency over the tone's duration. */
  glideTo?: number
}

function tone(freq: number, { at = 0, dur = 0.15, type = 'sine', vol = 0.12, glideTo }: ToneOpts = {}) {
  const c = audio()
  if (!c) return
  const t = c.currentTime + at
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t + dur)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(vol, t + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** Cheerful double blip for earning points. */
export function playCoin() {
  tone(988, { dur: 0.09, type: 'square', vol: 0.06 })
  tone(1319, { at: 0.08, dur: 0.18, type: 'square', vol: 0.06 })
}

/** Sad descending womp for penalties. */
export function playPenalty() {
  tone(220, { dur: 0.45, type: 'sawtooth', vol: 0.08, glideTo: 70 })
  tone(110, { at: 0.05, dur: 0.4, type: 'triangle', vol: 0.08, glideTo: 55 })
}

/** Quick happy triad for a completed daily quest. */
export function playQuest() {
  tone(523, { dur: 0.12 })
  tone(659, { at: 0.09, dur: 0.12 })
  tone(784, { at: 0.18, dur: 0.28 })
}

/** Rising fanfare for a level up. */
export function playLevelUp() {
  const notes = [523, 659, 784, 1047]
  notes.forEach((f, i) => tone(f, { at: i * 0.12, dur: i === notes.length - 1 ? 0.5 : 0.14, type: 'triangle', vol: 0.14 }))
  tone(1319, { at: 0.55, dur: 0.4, type: 'sine', vol: 0.08 })
}

/** Sparkly chime for an unlocked achievement. */
export function playAchievement() {
  tone(1047, { dur: 0.1, type: 'triangle' })
  tone(1319, { at: 0.09, dur: 0.1, type: 'triangle' })
  tone(1568, { at: 0.18, dur: 0.35, type: 'triangle' })
  tone(2093, { at: 0.2, dur: 0.3, type: 'sine', vol: 0.05 })
}

/** Punchy boom + ding for a critical hit. */
export function playCrit() {
  tone(150, { dur: 0.3, type: 'square', vol: 0.12, glideTo: 40 })
  tone(1568, { at: 0.12, dur: 0.12, type: 'square', vol: 0.07 })
  tone(2093, { at: 0.22, dur: 0.35, type: 'square', vol: 0.07 })
}
