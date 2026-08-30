import { DailyPet } from './DailyPet'
import { PET_STORAGE_KEY, usePetState } from '../hooks/usePetState'

/**
 * Standalone test page for the Daily Pet, reachable without unlocking the
 * app: http://localhost:5173/pet-test (or append #pet-test to any URL).
 */
export function PetTestPage() {
  const { petState, petPet, resetPet } = usePetState()

  /** Force the heartbroken state (happiness 0, unpetted) to preview it. */
  function makeSad() {
    const raw = localStorage.getItem(PET_STORAGE_KEY)
    const state = raw ? JSON.parse(raw) : {}
    localStorage.setItem(
      PET_STORAGE_KEY,
      JSON.stringify({ ...state, happiness: 0, lastPetted: '', streak: 0 }),
    )
    window.location.reload()
  }

  return (
    <div className="pet-test-page">
      <h1>🧪 Daily Pet — Test Page</h1>
      <p className="pet-test-hint">
        This page bypasses the login. The cat wanders along the{' '}
        <strong>bottom of the screen</strong> — click it to pet. ❗ = not petted today,
        💧 = heartbroken (happiness 0).
      </p>

      <DailyPet petState={petState} onPet={petPet} />

      <div className="pet-test-tools">
        <button onClick={resetPet}>🔄 Reset pet state (pet again)</button>
        <button onClick={makeSad}>😿 Make sad (happiness → 0)</button>
        <div className="pet-test-state">
          <pre>{JSON.stringify(petState, null, 2)}</pre>
        </div>
      </div>

      <style>{`
        .pet-test-page {
          min-height: 100vh;
          background: linear-gradient(160deg, #1a1a2e 0%, #16213e 100%);
          padding: 40px 16px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .pet-test-page h1 {
          text-align: center;
          color: #fff;
          margin: 0 0 8px;
          font-size: 26px;
        }
        .pet-test-hint {
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 24px;
          font-size: 14px;
        }
        .pet-test-tools {
          max-width: 460px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .pet-test-tools button {
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          background: #7c4dff;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .pet-test-tools button:hover {
          background: #651fff;
        }
        .pet-test-state pre {
          background: rgba(0, 0, 0, 0.4);
          color: #a5d6a7;
          border-radius: 8px;
          padding: 12px;
          font-size: 12px;
          overflow-x: auto;
          margin: 0;
        }
      `}</style>
    </div>
  )
}
