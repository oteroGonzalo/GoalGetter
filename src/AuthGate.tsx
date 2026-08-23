import { FormEvent, useEffect, useState } from 'react'
import App from './App'
import {
  decryptGithubToken,
  encryptGithubToken,
  forgetSessionToken,
  type GithubConfig,
  loadGithubConfig,
  rememberTokenForSession,
  sessionToken,
  verifyGithubAccess,
} from './githubStorage'

type Screen = 'loading' | 'setup' | 'unlock' | 'ready'

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export default function AuthGate() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [config, setConfig] = useState<GithubConfig | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [generated, setGenerated] = useState(false)

  useEffect(() => {
    loadGithubConfig()
      .then(async (loaded) => {
        setConfig(loaded)
        if (!loaded.encryptedToken) {
          setScreen('setup')
          return
        }
        const saved = sessionToken()
        if (!saved) {
          setScreen('unlock')
          return
        }
        try {
          await verifyGithubAccess(loaded, saved)
          setScreen('ready')
        } catch {
          forgetSessionToken()
          setScreen('unlock')
        }
      })
      .catch((reason) => {
        setError(message(reason))
        setScreen('setup')
      })
  }, [])

  async function unlock(event: FormEvent) {
    event.preventDefault()
    if (!config?.encryptedToken) return
    setWorking(true)
    setError('')
    try {
      const decrypted = await decryptGithubToken(config.encryptedToken, password)
      await verifyGithubAccess(config, decrypted)
      rememberTokenForSession(decrypted)
      setPassword('')
      setScreen('ready')
    } catch (reason) {
      forgetSessionToken()
      setError(message(reason))
    } finally {
      setWorking(false)
    }
  }

  async function createConfig(event: FormEvent) {
    event.preventDefault()
    if (!config) return
    if (password.length < 12) {
      setError('Use at least 12 characters; a five-word passphrase is better.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }
    if (!token.trim()) {
      setError('Enter the fine-grained GitHub token.')
      return
    }
    setWorking(true)
    setError('')
    try {
      await verifyGithubAccess(config, token.trim())
      const encryptedToken = await encryptGithubToken(token, password)
      const completed: GithubConfig = { ...config, encryptedToken }
      const blob = new Blob([`${JSON.stringify(completed, null, 2)}\n`], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'github-config.json'
      link.click()
      URL.revokeObjectURL(url)
      setToken('')
      setPassword('')
      setConfirmation('')
      setGenerated(true)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setWorking(false)
    }
  }

  if (screen === 'ready') {
    return <App />
  }

  if (screen === 'loading') {
    return <div className="auth-page"><div className="auth-card">Loading GoalGetter…</div></div>
  }

  if (screen === 'setup') {
    return (
      <div className="auth-page">
        <form className="auth-card" onSubmit={createConfig}>
          <div className="auth-icon">🔐</div>
          <h1>Connect GoalGetter</h1>
          <p>
            This one-time setup encrypts your restricted GitHub token locally. The token and
            password never leave this browser except for GitHub's access check.
          </p>
          {generated ? (
            <div className="auth-success">
              <strong>Encrypted configuration downloaded.</strong>
              <span>
                Replace <code>public/github-config.json</code> with the downloaded file, then
                commit and push it. The plaintext token was not saved.
              </span>
            </div>
          ) : (
            <>
              <label>
                Fine-grained GitHub token
                <input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                Shared password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Confirm shared password
                <input
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button type="submit" disabled={working}>
                {working ? 'Encrypting…' : 'Encrypt token and download config'}
              </button>
            </>
          )}
          {error && <div className="auth-error">{error}</div>}
        </form>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={unlock}>
        <div className="auth-icon">⚔️</div>
        <h1>Unlock GoalGetter</h1>
        <p>Enter the shared password. It decrypts the GitHub credential only for this tab.</p>
        <label>
          Shared password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>
        <button type="submit" disabled={working}>
          {working ? 'Unlocking…' : 'Unlock'}
        </button>
        {error && <div className="auth-error">{error}</div>}
      </form>
    </div>
  )
}
