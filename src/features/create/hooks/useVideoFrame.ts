/* src/features/create/hooks/useVideoFrame.ts

   Extrait une frame de la vidéo pour alimenter l'aperçu filtré.
   Rendre une frame coûte 150 ms ; rendre la vidéo entière à chaque
   mouvement de slider coûterait plusieurs secondes. */

import { useEffect, useRef, useState } from 'react'
import * as VideoThumbnails from 'expo-video-thumbnails'

export function useVideoFrame(uri: string | null, timeMs: number): string | null {
  const [frame, setFrame] = useState<string | null>(null)
  const cache = useRef(new Map<number, string>())

  useEffect(() => {
    if (!uri) { setFrame(null); return }

    /* Pas au milliseconde près : on arrondit à 250 ms pour que le
       scrub de la couverture tape dans le cache la plupart du temps. */
    const key = Math.round(timeMs / 250) * 250
    const hit = cache.current.get(key)
    if (hit) { setFrame(hit); return }

    let alive = true
    VideoThumbnails.getThumbnailAsync(uri, { time: key, quality: 0.6 })
      .then((result) => {
        if (!alive) return
        cache.current.set(key, result.uri)
        setFrame(result.uri)
      })
      .catch((error) => {
        console.warn('[useVideoFrame] Extraction impossible:', error)
      })

    return () => { alive = false }
  }, [uri, timeMs])

  return frame
}
