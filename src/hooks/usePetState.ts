import { useCallback, useEffect, useState } from 'react'
import { todayISO, type PetState } from '../components/DailyPet'

export const PET_STORAGE_KEY = 'goalgetter_pet_state'

const DAY_MS = 86_400_000
const DECAY_PER_DAY = 20
const HAPPINESS_PER_PET = 10

interface StoredPetState extends PetState {
  /** Last date the daily decay was applied, so reloads don't re-apply it. */
  lastDecay?: string
}

export const DEFAULT_PET_STATE: PetState = {
  petType: 'cat',
  happiness: 100,
  lastPetted: '',
  totalPets: 0,
  streak: 0,
}

/** Apply happiness decay for each full day the pet went unpetted (idempotent per day). */
function applyDecay(state: StoredPetState): StoredPetState {
  const today = todayISO()
  if (state.lastDecay === today) return state
  let happiness = state.happiness
  if (state.lastPetted && state.lastPetted !== today) {
    const from =
      state.lastDecay && state.lastDecay > state.lastPetted ? state.lastDecay : state.lastPetted
    const missedDays = Math.max(0, Math.floor((Date.parse(today) - Date.parse(from)) / DAY_MS))
    happiness = Math.max(0, happiness - DECAY_PER_DAY * missedDays)
  }
  return { ...state, happiness, lastDecay: today }
}

/**
 * Pet state with localStorage persistence, daily happiness decay,
 * and streak tracking.
 */
export function usePetState() {
  const [petState, setPetState] = useState<StoredPetState | null>(null)

  // Load from storage on mount
  useEffect(() => {
    let state: StoredPetState
    try {
      const stored = localStorage.getItem(PET_STORAGE_KEY)
      state = stored ? JSON.parse(stored) : { ...DEFAULT_PET_STATE }
    } catch (error) {
      console.error('Failed to load pet state:', error)
      state = { ...DEFAULT_PET_STATE }
    }
    setPetState(applyDecay(state))
  }, [])

  // Persist whenever the state changes
  useEffect(() => {
    if (petState) {
      localStorage.setItem(PET_STORAGE_KEY, JSON.stringify(petState))
    }
  }, [petState])

  const petPet = useCallback(() => {
    const today = todayISO()
    setPetState((prev) => {
      if (!prev || prev.lastPetted === today) return prev
      const yesterday = new Date(Date.parse(today) - DAY_MS).toISOString().split('T')[0]
      return {
        ...prev,
        happiness: Math.min(100, prev.happiness + HAPPINESS_PER_PET),
        lastPetted: today,
        totalPets: prev.totalPets + 1,
        streak: prev.lastPetted === yesterday ? prev.streak + 1 : 1,
      }
    })
  }, [])

  const resetPet = useCallback(() => {
    setPetState({ ...DEFAULT_PET_STATE, lastDecay: todayISO() })
  }, [])

  return {
    petState: petState ?? DEFAULT_PET_STATE,
    loading: petState === null,
    petPet,
    resetPet,
  }
}
