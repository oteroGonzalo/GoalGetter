import { useState } from 'react'
import type { Book, GameState, PlayerId } from '../types'

interface Props {
  state: GameState
  onAddBook: (title: string, totalPages: number, startPage: number) => void
  onLogProgress: (bookId: string, playerId: PlayerId, page: number) => void
  onRemoveBook: (bookId: string) => void
}

export function BookShelf({ state, onAddBook, onLogProgress, onRemoveBook }: Props) {
  const [title, setTitle] = useState('')
  const [pagesText, setPagesText] = useState('')
  const [startText, setStartText] = useState('')

  const totalPages = Number(pagesText)
  const startPage = startText === '' ? 0 : Number(startText)
  const canAdd =
    title.trim() !== '' &&
    Number.isFinite(totalPages) &&
    totalPages > 0 &&
    Number.isFinite(startPage) &&
    startPage >= 0 &&
    startPage <= totalPages

  function handleAdd() {
    if (!canAdd) return
    onAddBook(title.trim(), totalPages, startPage)
    setTitle('')
    setPagesText('')
    setStartText('')
  }

  return (
    <section className="panel">
      <h2>📖 Reading list</h2>

      <div className="book-add">
        <input
          className="book-add-title"
          placeholder="Book title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <input
          className="book-add-pages"
          type="number"
          min="1"
          placeholder="Total pages"
          value={pagesText}
          onChange={(e) => setPagesText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <input
          className="book-add-pages"
          type="number"
          min="0"
          placeholder="Start page (optional)"
          title="Page you're already on — those pages won't be scored"
          value={startText}
          onChange={(e) => setStartText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn-primary" disabled={!canAdd} onClick={handleAdd}>
          + Add book
        </button>
      </div>

      {state.books.length === 0 ? (
        <p className="book-empty">
          No books yet. Add one, then enter the page you're on each day — the pages you read become
          reading points. 📚
        </p>
      ) : (
        <div className="books-grid">
          {state.books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              state={state}
              onLogProgress={onLogProgress}
              onRemoveBook={onRemoveBook}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function BookCard({
  book,
  state,
  onLogProgress,
  onRemoveBook,
}: {
  book: Book
  state: GameState
  onLogProgress: (bookId: string, playerId: PlayerId, page: number) => void
  onRemoveBook: (bookId: string) => void
}) {
  const [pageText, setPageText] = useState('')

  const activity = state.activities.find((a) => a.id === book.activityId)
  const pct = Math.max(0, Math.min(100, (book.currentPage / book.totalPages) * 100))
  const finished = book.currentPage >= book.totalPages

  const page = Number(pageText)
  const valid =
    Number.isFinite(page) && page > book.currentPage && page <= book.totalPages
  const pagesRead = valid ? page - book.currentPage : 0
  const preview = activity ? Math.round(pagesRead * activity.pointsPerUnit) : 0

  function handleLog(playerId: PlayerId) {
    if (!valid) return
    onLogProgress(book.id, playerId, page)
    setPageText('')
  }

  return (
    <div className={`activity-card book-card ${finished ? 'done' : ''}`}>
      <div className="activity-header">
        <span className="activity-emoji">{finished ? '✅' : '📕'}</span>
        <span className="activity-name">{book.title}</span>
        <button
          className="btn-remove"
          title="Remove book"
          onClick={() => {
            if (window.confirm(`Remove "${book.title}" from the reading list?`)) onRemoveBook(book.id)
          }}
        >
          ✕
        </button>
      </div>

      <div className="activity-bar">
        <div className="activity-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="activity-progress-label">
        Page {book.currentPage} / {book.totalPages} {finished ? '— finished! 🎉' : `(${Math.round(pct)}%)`}
      </div>

      {!finished && (
        <>
          <div className="activity-qty-row">
            <input
              className="qty-input"
              type="number"
              min={book.currentPage + 1}
              max={book.totalPages}
              placeholder="page #"
              value={pageText}
              onChange={(e) => setPageText(e.target.value)}
            />
            <span className="qty-unit">page you're on</span>
            <span className="qty-preview pos">
              {valid ? `+${pagesRead} pg · +${preview} pts` : '—'}
            </span>
          </div>
          <div className="activity-buttons">
            {state.players.map((p) => (
              <button
                key={p.id}
                className="log-btn"
                disabled={!valid}
                onClick={() => handleLog(p.id)}
                title={`Log reading for ${p.name}`}
              >
                {p.avatar} {p.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
