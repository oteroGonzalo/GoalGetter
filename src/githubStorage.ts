import initialStateJson from '../server/data.json'
import type { GameState } from './types'
import { computeQuests, defaultQuestPool } from './quests'

const API_ROOT = 'https://api.github.com'
const CACHE_KEY = 'goalgetter-state-cache-v1'
const TOKEN_SESSION_KEY = 'goalgetter-github-token'
const MAX_WRITE_ATTEMPTS = 6

export interface EncryptedToken {
  version: 1
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

export interface GithubConfig {
  owner: string
  repo: string
  branch: string
  path: string
  encryptedToken: EncryptedToken | null
}

interface GithubFileResponse {
  content: string
  encoding: string
  sha: string
}

interface GithubRefResponse {
  object: { sha: string }
}

export class GithubStorageError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
  }
}

let activeConfig: GithubConfig | null = null
let activeToken = ''
let usingCache = false
let mutationQueue: Promise<void> = Promise.resolve()
const statusListeners = new Set<(cached: boolean) => void>()

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s/g, ''))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}

function persistedState(state: GameState): GameState {
  const copy = cloneState(state)
  delete copy.quests
  return copy
}

function hydrateState(raw: GameState): GameState {
  const state = cloneState(raw)
  state.books = Array.isArray(state.books) ? state.books : []
  state.questPool = Array.isArray(state.questPool) ? state.questPool : defaultQuestPool()
  state.prize = typeof state.prize === 'string' ? state.prize : ''
  state.quests = computeQuests(state)
  return state
}

function setCacheStatus(next: boolean): void {
  if (usingCache === next) return
  usingCache = next
  for (const listener of statusListeners) listener(next)
}

function requireConfig(): GithubConfig {
  if (!activeConfig || !activeToken) throw new GithubStorageError('GoalGetter is locked')
  return activeConfig
}

async function githubRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!activeToken) throw new GithubStorageError('GoalGetter is locked')
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${activeToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    throw new GithubStorageError(
      body.message ?? `GitHub request failed (${response.status})`,
      response.status,
    )
  }
  return (await response.json()) as T
}

function repositoryPath(config: GithubConfig): string {
  return `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`
}

async function ensureDataBranch(config: GithubConfig): Promise<void> {
  const repository = repositoryPath(config)
  try {
    await githubRequest<GithubRefResponse>(
      `${repository}/git/ref/heads/${encodeURIComponent(config.branch)}`,
    )
    return
  } catch (error) {
    if (!(error instanceof GithubStorageError) || error.status !== 404) throw error
  }

  const repo = await githubRequest<{ default_branch: string }>(repository)
  let source: GithubRefResponse
  try {
    source = await githubRequest<GithubRefResponse>(
      `${repository}/git/ref/heads/${encodeURIComponent(repo.default_branch)}`,
    )
  } catch (error) {
    if (error instanceof GithubStorageError && (error.status === 404 || error.status === 409)) {
      throw new GithubStorageError('Push the application before initializing its data branch')
    }
    throw error
  }

  try {
    await githubRequest(`${repository}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${config.branch}`, sha: source.object.sha }),
    })
  } catch (error) {
    if (!(error instanceof GithubStorageError) || error.status !== 422) throw error
  }
}

async function readRemoteState(): Promise<{ state: GameState; sha: string } | null> {
  const config = requireConfig()
  const repository = repositoryPath(config)
  const filePath = config.path.split('/').map(encodeURIComponent).join('/')
  try {
    const file = await githubRequest<GithubFileResponse>(
      `${repository}/contents/${filePath}?ref=${encodeURIComponent(config.branch)}`,
    )
    if (file.encoding !== 'base64') {
      throw new GithubStorageError('GitHub returned an unsupported file encoding')
    }
    const decoded = new TextDecoder().decode(base64ToBytes(file.content))
    return { state: hydrateState(JSON.parse(decoded) as GameState), sha: file.sha }
  } catch (error) {
    if (error instanceof GithubStorageError && error.status === 404) return null
    throw error
  }
}

async function writeRemoteState(
  state: GameState,
  sha: string | null,
  message: string,
): Promise<string> {
  const config = requireConfig()
  const repository = repositoryPath(config)
  const filePath = config.path.split('/').map(encodeURIComponent).join('/')
  const bytes = new TextEncoder().encode(`${JSON.stringify(persistedState(state), null, 2)}\n`)
  const response = await githubRequest<{ content: { sha: string } }>(
    `${repository}/contents/${filePath}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: `GoalGetter: ${message}`,
        content: bytesToBase64(bytes),
        branch: config.branch,
        ...(sha ? { sha } : {}),
      }),
    },
  )
  return response.content.sha
}

async function initializeRemoteState(): Promise<{ state: GameState; sha: string }> {
  const config = requireConfig()
  await ensureDataBranch(config)
  const existing = await readRemoteState()
  if (existing) return existing
  const state = hydrateState(initialStateJson as unknown as GameState)
  try {
    const sha = await writeRemoteState(state, null, 'initialize saved data')
    return { state, sha }
  } catch (error) {
    if (error instanceof GithubStorageError && (error.status === 409 || error.status === 422)) {
      const raced = await readRemoteState()
      if (raced) return raced
    }
    throw error
  }
}

async function remoteState(): Promise<{ state: GameState; sha: string }> {
  return (await readRemoteState()) ?? initializeRemoteState()
}

function cacheState(state: GameState): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(persistedState(state)))
}

function cachedState(): GameState | null {
  const raw = localStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try {
    return hydrateState(JSON.parse(raw) as GameState)
  } catch {
    localStorage.removeItem(CACHE_KEY)
    return null
  }
}

export async function loadGithubConfig(): Promise<GithubConfig> {
  const response = await fetch(`${import.meta.env.BASE_URL}github-config.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load github-config.json')
  return (await response.json()) as GithubConfig
}

async function passwordKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: arrayBuffer(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptGithubToken(token: string, password: string): Promise<EncryptedToken> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const iterations = 600_000
  const key = await passwordKey(password, salt, iterations)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: arrayBuffer(iv) },
    key,
    new TextEncoder().encode(token.trim()),
  )
  return {
    version: 1,
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

export async function decryptGithubToken(vault: EncryptedToken, password: string): Promise<string> {
  try {
    const salt = base64ToBytes(vault.salt)
    const iv = base64ToBytes(vault.iv)
    const key = await passwordKey(password, salt, vault.iterations)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: arrayBuffer(iv) },
      key,
      arrayBuffer(base64ToBytes(vault.ciphertext)),
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    throw new GithubStorageError('Incorrect password')
  }
}

export function configureGithubStorage(config: GithubConfig, token: string): void {
  activeConfig = config
  activeToken = token
}

export async function verifyGithubAccess(config: GithubConfig, token: string): Promise<void> {
  configureGithubStorage(config, token)
  await githubRequest(repositoryPath(config))
}

export function rememberTokenForSession(token: string): void {
  sessionStorage.setItem(TOKEN_SESSION_KEY, token)
}

export function sessionToken(): string | null {
  return sessionStorage.getItem(TOKEN_SESSION_KEY)
}

export function forgetSessionToken(): void {
  sessionStorage.removeItem(TOKEN_SESSION_KEY)
  activeToken = ''
}

export function subscribeStorageStatus(listener: (cached: boolean) => void): () => void {
  statusListeners.add(listener)
  listener(usingCache)
  return () => statusListeners.delete(listener)
}

export async function fetchGithubState(): Promise<GameState> {
  try {
    const remote = await remoteState()
    cacheState(remote.state)
    setCacheStatus(false)
    return remote.state
  } catch (error) {
    const fallback = cachedState()
    if (!fallback) throw error
    setCacheStatus(true)
    return fallback
  }
}

function conflictDelay(attempt: number): Promise<void> {
  const milliseconds = 100 * 2 ** attempt + Math.floor(Math.random() * 150)
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function performGithubMutation<T>(
  message: string,
  change: (state: GameState) => T,
): Promise<{ state: GameState; result: T }> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    try {
      const remote = await remoteState()
      const state = persistedState(remote.state)
      const result = change(state)
      const hydrated = hydrateState(state)
      await writeRemoteState(hydrated, remote.sha, message)
      cacheState(hydrated)
      setCacheStatus(false)
      return { state: hydrated, result }
    } catch (error) {
      lastError = error
      if (
        !(error instanceof GithubStorageError) ||
        (error.status !== 409 && error.status !== 422)
      ) break
      await conflictDelay(attempt)
    }
  }
  setCacheStatus(true)
  throw lastError
}

/**
 * Serialize writes made by this tab. GitHub's Contents API rejects two updates
 * based on the same file SHA, so a local queue avoids avoidable conflicts while
 * performGithubMutation still retries genuine cross-device races.
 */
export function mutateGithubState<T>(
  message: string,
  change: (state: GameState) => T,
): Promise<{ state: GameState; result: T }> {
  const pending = mutationQueue.then(
    () => performGithubMutation(message, change),
    () => performGithubMutation(message, change),
  )
  mutationQueue = pending.then(
    () => undefined,
    () => undefined,
  )
  return pending
}
