import { useEffect, useState } from 'react'

/**
 * Load a sprite sheet image. Returns the image once loaded (null while
 * loading) plus an error message if the file could not be fetched.
 */
export function useSpriteImage(url: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setImage(null)
    setError(null)

    const img = new Image()
    img.src = url
    img.onload = () => {
      if (!cancelled) setImage(img)
    }
    img.onerror = () => {
      if (!cancelled) setError(`Failed to load sprite: ${url}`)
    }
    return () => {
      cancelled = true
    }
  }, [url])

  return { image, error, loading: !image && !error }
}
