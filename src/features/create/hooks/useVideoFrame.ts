/* src/features/create/hooks/useVideoFrame.ts

   Extrait une frame de la vidéo pour alimenter l'aperçu filtré.
   Rendre une frame coûte 150 ms ; rendre la vidéo entière à chaque
   mouvement de slider coûterait plusieurs secondes. */

import { useEffect, useRef, useState } from 'react'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { captureException } from '@/lib/sentry'

export function useVideoFrame(uri: string | null, timeMs: number): string | null {
  const [frame, setFrame] = useState<string | null>(null)
  const cache = useRef(new Map<string, string>())

  useEffect(() => {
    if (!uri) { setFrame(null); return }

    /* Pas au milliseconde près : on arrondit à 250 ms pour que le
       scrub de la couverture tape dans le cache la plupart du temps. */
    const roundedTime = Math.round(timeMs / 250) * 250
    const key = `${uri}:${roundedTime}`
    const hit = cache.current.get(key)
    if (hit) { setFrame(hit); return }

    let alive = true
    VideoThumbnails.getThumbnailAsync(uri, { time: roundedTime, quality: 0.6 })
      .then((result) => {
        if (!alive) return
        cache.current.set(key, result.uri)
        setFrame(result.uri)
      })
      .catch((error) => {
        captureException(error instanceof Error ? error : new Error(String(error)), {
          context: 'create.videoFrame',
        })
      })

    return () => { alive = false }
  }, [uri, timeMs])

  return frame
}
