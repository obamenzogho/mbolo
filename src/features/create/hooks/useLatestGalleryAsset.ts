/* src/features/create/hooks/useLatestGalleryAsset.ts

   Vignette galerie de la caméra studio (clone Instagram) : la dernière
   photo/vidéo de la pellicule s'affiche à gauche du déclencheur, et un
   appui ouvre la galerie. Le fetch est volontairement local (expo-media-library
   lit le cache de la pellicule, pas Firestore) : une prise de vue est
   immédiatement visible via `refresh`. */

import { useEffect, useRef, useState } from 'react'
import * as MediaLibrary from 'expo-media-library'
import { captureException } from '@/lib/sentry'

export interface LatestGalleryAsset {
  uri: string
  mediaType: 'photo' | 'video' | 'unknown'
}

const LATEST_FETCH_LIMIT = 1

function normalizeMediaType(mediaType: string): LatestGalleryAsset['mediaType'] {
  if (mediaType === 'photo' || mediaType === 'video') return mediaType
  return 'unknown'
}

export function useLatestGalleryAsset() {
  const [permission] = MediaLibrary.usePermissions()
  const [latest, setLatest] = useState<LatestGalleryAsset | null>(null)
  const [available, setAvailable] = useState(false)
  const fetchingRef = useRef(false)

  /* Fonction plain (pas de useCallback) : elle lit/écrit une ref
     (fetchingRef), ce que le React Compiler ne peut pas mémoïser
     manuellement ; il s'en charge lui-même. */
  const refresh = async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      /* Permission absente : aucun setState — la valeur initiale
         (`available=false`) reste la bonne. */
      if (permission?.status !== 'granted') return
      const result = await MediaLibrary.getAssetsAsync({
        first: LATEST_FETCH_LIMIT,
        sortBy: [MediaLibrary.SortBy.creationTime],
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      })
      const asset = result.assets[0]
      setLatest(
        asset
          ? { uri: asset.uri, mediaType: normalizeMediaType(asset.mediaType) }
          : null,
      )
      setAvailable(true)
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'create.camera.latestAsset',
      })
      setAvailable(false)
    } finally {
      fetchingRef.current = false
    }
  }

  /* Chargement initial : async IIFE inline (pattern useUserLocation) — le
     React Compiler rejette l'appel direct d'une fonction qui setState dans
     un effet. `refresh` reste exposé pour les refetchs depuis les event
     handlers (prise de vue), où il est appelé sans effet. */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (fetchingRef.current) return
      fetchingRef.current = true
      try {
        if (permission?.status !== 'granted') return
        const result = await MediaLibrary.getAssetsAsync({
          first: LATEST_FETCH_LIMIT,
          sortBy: [MediaLibrary.SortBy.creationTime],
          mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        })
        if (cancelled) return
        const asset = result.assets[0]
        setLatest(
          asset
            ? { uri: asset.uri, mediaType: normalizeMediaType(asset.mediaType) }
            : null,
        )
        setAvailable(true)
      } catch (error) {
        captureException(error instanceof Error ? error : new Error(String(error)), {
          context: 'create.camera.latestAsset',
        })
        if (!cancelled) setAvailable(false)
      } finally {
        fetchingRef.current = false
      }
    })()
    return () => {
      cancelled = true
    }
  }, [permission?.status])

  return { latest, available, refresh }
}
