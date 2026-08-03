/* src/features/create/hooks/useFilmstrip.ts

   Bande de vignettes pour le trim. Les frames arrivent une par une et
   dans l'ordre : la bande se remplit de gauche à droite au lieu de
   clignoter d'un coup après deux secondes de vide. */

import { useEffect, useRef, useState } from 'react'
import * as VideoThumbnails from 'expo-video-thumbnails'

export const FILMSTRIP_FRAMES = 8

export function useFilmstrip(uri: string | null, durationMs: number) {
  const [frames, setFrames] = useState<(string | null)[]>(
    () => Array(FILMSTRIP_FRAMES).fill(null),
  )
  const done = useRef<string | null>(null)

  useEffect(() => {
    if (!uri || durationMs <= 0) return
    /* La bande couvre la vidéo entière : inutile de la régénérer
       quand les poignées de trim bougent. */
    if (done.current === uri) return
    done.current = uri

    let alive = true
    setFrames(Array(FILMSTRIP_FRAMES).fill(null))

    ;(async () => {
      for (let i = 0; i < FILMSTRIP_FRAMES; i += 1) {
        if (!alive) return
        const time = Math.floor((durationMs / FILMSTRIP_FRAMES) * i)
        try {
          const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(uri, {
            time,
            quality: 0.3,
          })
          if (!alive) return
          setFrames((prev) => {
            const next = [...prev]
            next[i] = thumb
            return next
          })
        } catch {
          /* Une frame manquante laisse une case grise, ce n'est pas
             bloquant — mais on le sait. */
          console.warn(`[useFilmstrip] Frame ${i} indisponible`)
        }
      }
    })()

    return () => { alive = false }
  }, [uri, durationMs])

  return frames
}
