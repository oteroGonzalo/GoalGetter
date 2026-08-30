import { useCallback, useEffect, useState } from 'react'
import { applyPet, defaultPetState, effectivePet, type PetState } from '../pet'

export const PET_STORAGE_KEY = 'goalgetter_pet_state'

/**
 * Local (per-browser) pet state used by the /pet-test page only. The real
 * app stores the shared pet inside the GitHub-backed GameState — see
 * petCat() in src/api.ts. Both use the same rules from src/pet.ts.
 */
export function usePetState() {
  const [petState, setPetState] = useState<PetState | null>(null)

  // Load from storage on mount, applying decay for missed days
  useEffect(() => {
    let stored: unknown
    try {
      stored = JSON.parse(localStorage.getItem(PET_STORAGE_KEY) ?? 'null')
    } catch {
      stored = null
    }
    setPetState(effectivePet((stored as PetState) ?? undefined))
  }, [])

  // Persist whenever the state changes
  useEffect(() => {
    if (petState) {
      localStorage.setItem(PET_STORAGE_KEY, JSON.stringify(petState))
    }
  }, [petState])

  const petPet = useCallback(() => {
    setPetState((prev) => (prev ? applyPet(prev) : prev))
  }, [])

  const resetPet = useCallback(() => {
    setPetState(defaultPetState())
  }, [])

  return {
    petState: petState ?? defaultPetState(),
    loading: petState === null,
    petPet,
    resetPet,
  }
}
