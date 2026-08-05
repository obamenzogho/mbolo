/* src/features/create/hooks/useEditPreviewProxy.ts

   L'aperçu ne sait pas appliquer une matrice couleur en natif. Plutôt que
   d'approximer en JS (et de mentir à l'utilisateur), on rend une vraie
   miniature 320px avec le MÊME filterGraph que la publication : ce qu'on
   voit est exactement ce qui sera publié.

   Coût maîtrisé : debounce 250 ms, annulation de la session en vol,
   et cache mémoire par signature d'édition (revenir sur un filtre déjà
   vu est instantané). */

import { useCallback, useEffect, useRef, useState } from 'react'
import { captureException } from '@/lib/sentry'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import { needsRender } from '../utils/filterGraph'
import { cancelRender, renderPhoto } from '../utils/renderMedia'

/** Côté max du proxy. 320 suffit à l'aperçu et rend en ~150 ms. */
const PROXY_SIZE = 320
const DEBOUNCE_MS = 250
/** Au-delà, on évince le plus ancien : ~40 Ko par entrée sur disque. */
const CACHE_MAX = 24

/** Signature de tout ce qui change le rendu. Les overlays sont exclus :
    ils sont dessinés en direct par React, pas gravés dans le proxy. */
function signature(media: SelectedMedia, frameUri: string, geometryMode: string): string {
  const c = media.crop
  const a = media.adjustments
  const parts = [frameUri, geometryMode]
  if (geometryMode === 'all') {
    parts.push(c ? `${c.aspect}|${c.freeformAspect ?? '-'}|${c.rotation}|${c.straighten ?? 0}|${c.flipH}|${c.flipV}|${c.cropX}|${c.cropY}` : '-')
    parts.push(media.cropTransform
      ? `${media.cropTransform.scale}|${media.cropTransform.translateX}|${media.cropTransform.translateY}`
      : '-')
  } else {
    parts.push(c ? `s:${c.straighten ?? 0}` : '-')
  }
  parts.push(`${media.filterId ?? 'none'}:${media.filterIntensity ?? 100}`)
  parts.push(`${media.effectId ?? 'ef-none'}:${media.effectIntensity ?? 100}`)
  parts.push(a ? Object.values(a).join(',') : '-')
  return parts.join('#')
}

interface ProxyState {
  /** URI à afficher : le proxy rendu, ou la source si rien à rendre. */
  uri: string
  /** Un rendu est en cours — utile pour un voile discret sur l'aperçu. */
  rendering: boolean
}

/**
 * @param media       Le média en cours d'édition.
 * @param frameUri    Source à rendre : l'image, ou la frame extraite pour
 *                    une vidéo (voir useVideoFrame plus bas).
 */
export function useEditPreviewProxy(
  media: SelectedMedia,
  frameUri: string | null,
  geometryMode: 'all' | 'color' = 'all',
): ProxyState {
  const source = frameUri ?? media.uri
  const [state, setState] = useState<ProxyState>({ uri: source, rendering: false })

  const cache = useRef(new Map<string, string>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionId = useRef<number | undefined>(undefined)
  /* Empêche une réponse tardive d'écraser un rendu plus récent. */
  const latest = useRef('')
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (timer.current) clearTimeout(timer.current)
      if (sessionId.current) cancelRender(sessionId.current)
    }
  }, [])

  const remember = useCallback((key: string, uri: string) => {
    const map = cache.current
    map.set(key, uri)
    if (map.size > CACHE_MAX) {
      const oldest = map.keys().next().value
      if (oldest) map.delete(oldest)
    }
  }, [])

  const sig = signature(media, source, geometryMode)

  useEffect(() => {
    if (!source) return

    /* Rien à rendre : la source EST l'aperçu fidèle. */
    if (!needsRender({
      width: media.width ?? 1080,
      height: media.height ?? 1080,
      crop: media.crop,
      filterId: media.filterId,
      effectId: media.effectId,
      adjustments: media.adjustments,
      geometryMode,
    })) {
      latest.current = sig
      setState({ uri: source, rendering: false })
      return
    }

    /* Déjà rendu : affichage immédiat, zéro FFmpeg. */
    const hit = cache.current.get(sig)
    if (hit) {
      latest.current = sig
      setState({ uri: hit, rendering: false })
      return
    }

    latest.current = sig
    setState((prev) => ({ ...prev, rendering: true }))

    /* Le debounce absorbe le drag d'un slider : on ne rend que la
       valeur sur laquelle le doigt s'arrête. */
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (sessionId.current) cancelRender(sessionId.current)

      renderPhoto(
        {
          ...media,
          uri: source,
          type: 'image',
          /* Les overlays sont dessinés par React par-dessus l'aperçu. */
          overlay: undefined,
        },
        {
          maxSize: PROXY_SIZE,
          geometryMode,
          onSession: (id) => { sessionId.current = id },
        },
      )
        .then((result) => {
          if (!alive.current || latest.current !== sig) return
          remember(sig, result.uri)
          setState({ uri: result.uri, rendering: false })
        })
        .catch((error) => {
          captureException(
            error instanceof Error ? error : new Error(String(error)),
            { context: 'create.previewProxy' },
          )
          if (alive.current) setState({ uri: source, rendering: false })
        })
    }, DEBOUNCE_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [sig, source, media, remember])

  return state
}
