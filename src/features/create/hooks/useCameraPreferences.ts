/* useCameraPreferences.ts — Préférences caméra persistées.

   La grille, le miroir selfie, la qualité vidéo, la stabilisation et la
   sauvegarde dans la pellicule survivent au redémarrage. Stockage unique
   versionné (camera.preferences.v1) : toute clé inconnue ou invalide est
   ignorée au chargement, et les défauts comblent les trous — un parse
   strict protège contre un JSON corrompu qui casserait la caméra. */

import { useCallback, useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '@/lib/sentry'
import { isVideoQualityOption, type VideoQualityOption } from '../types/editing'

export interface CameraPreferences {
  showGrid: boolean
  mirrorSelfie: boolean
  videoQuality: VideoQualityOption
  videoStabilization: boolean
  saveToLibrary: boolean
}

export const CAMERA_PREFERENCES_KEY = 'camera.preferences.v1'

export const DEFAULT_CAMERA_PREFERENCES: CameraPreferences = {
  showGrid: false,
  /* Une vue frontale se regarde à l'endroit : le miroir est le bon défaut. */
  mirrorSelfie: true,
  videoQuality: '1080p',
  videoStabilization: true,
  saveToLibrary: false,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Parse strict d'un JSON stocké : clés inconnues ignorées, valeurs
    invalides remplacées par les défauts. Ne throw jamais. */
export function parseCameraPreferences(raw: string | null): CameraPreferences {
  if (!raw) return { ...DEFAULT_CAMERA_PREFERENCES }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { ...DEFAULT_CAMERA_PREFERENCES }

    return {
      showGrid:
        typeof parsed.showGrid === 'boolean'
          ? parsed.showGrid
          : DEFAULT_CAMERA_PREFERENCES.showGrid,
      mirrorSelfie:
        typeof parsed.mirrorSelfie === 'boolean'
          ? parsed.mirrorSelfie
          : DEFAULT_CAMERA_PREFERENCES.mirrorSelfie,
      videoQuality: isVideoQualityOption(parsed.videoQuality)
        ? parsed.videoQuality
        : DEFAULT_CAMERA_PREFERENCES.videoQuality,
      videoStabilization:
        typeof parsed.videoStabilization === 'boolean'
          ? parsed.videoStabilization
          : DEFAULT_CAMERA_PREFERENCES.videoStabilization,
      saveToLibrary:
        typeof parsed.saveToLibrary === 'boolean'
          ? parsed.saveToLibrary
          : DEFAULT_CAMERA_PREFERENCES.saveToLibrary,
    }
  } catch {
    return { ...DEFAULT_CAMERA_PREFERENCES }
  }
}

export function useCameraPreferences() {
  const [preferences, setPreferences] = useState<CameraPreferences>(
    DEFAULT_CAMERA_PREFERENCES,
  )
  /* Un éventuel `setItem` avant la fin du chargement écraserait la valeur
     stockée par un snapshot partiel de défauts. */
  const loadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(CAMERA_PREFERENCES_KEY)
        if (cancelled) return
        setPreferences(parseCameraPreferences(raw))
      } catch (error) {
        captureException(error instanceof Error ? error : new Error(String(error)), {
          context: 'create.camera.loadPreferences',
        })
      } finally {
        if (!cancelled) loadedRef.current = true
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loadedRef.current) return

    AsyncStorage.setItem(CAMERA_PREFERENCES_KEY, JSON.stringify(preferences)).catch(
      (error: unknown) => {
        captureException(error instanceof Error ? error : new Error(String(error)), {
          context: 'create.camera.savePreferences',
        })
      },
    )
  }, [preferences])

  const updatePreferences = useCallback((patch: Partial<CameraPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }))
  }, [])

  return { preferences, updatePreferences }
}
