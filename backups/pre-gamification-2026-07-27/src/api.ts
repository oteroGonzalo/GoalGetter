import type { Activity, Book, GameState, LogEntry, Player, PlayerId } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchState(): Promise<GameState> {
  return request<GameState>('/api/state')
}

export function postLog(playerId: PlayerId, activityId: string, quantity: number): Promise<LogEntry> {
  return request<LogEntry>('/api/log', {
    method: 'POST',
    body: JSON.stringify({ playerId, activityId, quantity }),
  })
}

export function deleteLog(entryId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/log/${entryId}`, { method: 'DELETE' })
}

export function putSettings(
  players: [Player, Player],
  activities: Activity[],
  prize: string,
): Promise<GameState> {
  return request<GameState>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ players, activities, prize }),
  })
}

export function resetProgress(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/reset', { method: 'POST' })
}

export function createBook(
  title: string,
  totalPages: number,
  startPage = 0,
  activityId?: string,
): Promise<GameState> {
  return request<GameState>('/api/books', {
    method: 'POST',
    body: JSON.stringify({ title, totalPages, startPage, activityId }),
  })
}

export function logBookProgress(
  bookId: string,
  playerId: PlayerId,
  page: number,
): Promise<{ state: GameState; entry: LogEntry }> {
  return request<{ state: GameState; entry: LogEntry }>(`/api/books/${bookId}/progress`, {
    method: 'POST',
    body: JSON.stringify({ playerId, page }),
  })
}

export function updateBook(bookId: string, patch: Partial<Book>): Promise<GameState> {
  return request<GameState>(`/api/books/${bookId}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
}

export function deleteBook(bookId: string): Promise<GameState> {
  return request<GameState>(`/api/books/${bookId}`, { method: 'DELETE' })
}
