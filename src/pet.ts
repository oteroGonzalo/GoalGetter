/**
 * Shared state and rules for the site cat. One cat for both players,
 * persisted inside the GitHub-backed GameState. Decay is derived at read
 * time from lastPetted (via effectivePet) so nothing needs a background
 * write; the only mutation is applyPet when someone pets the cat.
 */

export interface PetState {
  /** 0-100, as of the last pet. Display via effectivePet, which applies decay. */
  happiness: number
  /** ISO date (YYYY-MM-DD) of the last pet, '' if never petted. */
  lastPetted: string
  totalPets: number
  /** Consecutive days petted. */
  streak: number
}

const DAY_MS = 86_400_000
const DECAY_PER_DAY = 20
const HAPPINESS_PER_PET = 10

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function defaultPetState(): PetState {
  return { happiness: 100, lastPetted: '', totalPets: 0, streak: 0 }
}

/** Coerce whatever is stored (possibly missing or malformed) into a valid PetState. */
export function normalizePetState(raw: unknown): PetState {
  const base = defaultPetState()
  if (!raw || typeof raw !== 'object') return base
  const pet = raw as Partial<PetState>
  return {
    happiness: Number.isFinite(pet.happiness)
      ? Math.min(100, Math.max(0, Number(pet.happiness)))
      : base.happiness,
    lastPetted: typeof pet.lastPetted === 'string' ? pet.lastPetted : '',
    totalPets: Number.isFinite(pet.totalPets) ? Math.max(0, Math.floor(Number(pet.totalPets))) : 0,
    streak: Number.isFinite(pet.streak) ? Math.max(0, Math.floor(Number(pet.streak))) : 0,
  }
}

/** Whole days from ISO date a to ISO date b. */
function daysBetween(a: string, b: string): number {
  return Math.floor((Date.parse(b) - Date.parse(a)) / DAY_MS)
}

/**
 * The pet as it should be displayed today: happiness drops 20 per fully
 * missed day. Petting yesterday costs nothing today — the first MISSED
 * day starts the decay (pet daily and happiness only ever climbs).
 */
export function effectivePet(raw: PetState | undefined, today = todayISO()): PetState {
  const pet = normalizePetState(raw)
  if (!pet.lastPetted) return pet
  const missed = Math.max(0, daysBetween(pet.lastPetted, today) - 1)
  if (!missed) return pet
  return { ...pet, happiness: Math.max(0, pet.happiness - DECAY_PER_DAY * missed) }
}

/** Pet the cat today. No-op if it was already petted today. */
export function applyPet(raw: PetState | undefined, today = todayISO()): PetState {
  const pet = normalizePetState(raw)
  if (pet.lastPetted === today) return pet
  const effective = effectivePet(pet, today)
  const pettedYesterday = pet.lastPetted !== '' && daysBetween(pet.lastPetted, today) === 1
  return {
    happiness: Math.min(100, effective.happiness + HAPPINESS_PER_PET),
    lastPetted: today,
    totalPets: pet.totalPets + 1,
    streak: pettedYesterday ? pet.streak + 1 : 1,
  }
}
