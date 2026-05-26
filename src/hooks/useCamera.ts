import { useState, useCallback } from 'react'
import { Camera } from 'expo-camera'
import * as MediaLibrary from 'expo-media-library'
import * as ImagePicker from 'expo-image-picker'
import { captureException } from '../lib/sentry'

/**
 * Filtres visuels applicables aux vidéos/photos
 */
export const FILTERS = [
  { name: 'Normal', style: null as Record<string, number> | null },
  { name: 'Noir & Blanc', style: { saturate: 0 } },
  { name: 'Chaud', style: { sepia: 0.3 } },
  { name: 'Froid', style: { hueRotate: 180 } },
  { name: 'Vintage', style: { sepia: 0.5, contrast: 1.2 } },
  { name: 'Vif', style: { saturate: 1.8, contrast: 1.1 } },
  { name: 'Doux', style: { brightness: 1.15, saturate: 0.85 } },
  { name: 'Cinéma', style: { contrast: 1.3, saturate: 0.7, sepia: 0.15 } },
]

export type FilterName = typeof FILTERS[number]['name']

/**
 * Hook pour gérer les permissions, la galerie et les filtres
 */
export function useCamera() {
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null)
  const [micPermission, setMicPermission] = useState<boolean | null>(null)
  const [mediaPermission, setMediaPermission] = useState<boolean | null>(null)

  /**
   * Demande toutes les permissions requises
   */
  const requestPermissions = useCallback(async () => {
    try {
      const { status: camStatus } = await Camera.requestCameraPermissionsAsync()
      setCameraPermission(camStatus === 'granted')

      const { status: micStatus } = await Camera.requestMicrophonePermissionsAsync()
      setMicPermission(micStatus === 'granted')

      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync()
      setMediaPermission(mediaStatus === 'granted')

      return {
        camera: camStatus === 'granted',
        mic: micStatus === 'granted',
        media: mediaStatus === 'granted',
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'requestPermissions' })
      console.error('Permission request failed:', e)
      return { camera: false, mic: false, media: false }
    }
  }, [])

  /**
   * Sauvegarde un média dans la galerie du device
   */
  const saveToGallery = useCallback(async (uri: string): Promise<boolean> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') return false

      const asset = await MediaLibrary.createAssetAsync(uri)
      return !!asset
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'saveToGallery' })
      console.error('saveToGallery error:', e)
      return false
    }
  }, [])

  /**
   * Ouvre la galerie pour choisir un média existant
   */
  const pickFromGallery = useCallback(async (options?: {
    mediaTypes?: ('images' | 'videos')[]
    allowsMultipleSelection?: boolean
    selectionLimit?: number
    quality?: number
  }): Promise<string | null> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: options?.mediaTypes || ['images', 'videos'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: options?.quality ?? 0.9,
        allowsMultipleSelection: options?.allowsMultipleSelection ?? false,
        selectionLimit: options?.selectionLimit ?? 1,
      })

      if (!result.canceled && result.assets.length > 0) {
        return result.assets[0].uri
      }
      return null
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'pickFromGallery' })
      console.error('pickFromGallery error:', e)
      return null
    }
  }, [])

  /**
   * Applique un filtre CSS à un URI (pour prévisualisation)
   * Retourne une string filter CSS compatible avec React Native
   */
  const applyFilter = useCallback((filterName: FilterName): string => {
    const filter = FILTERS.find(f => f.name === filterName)
    if (!filter || !filter.style) return ''

    const parts: string[] = []
    if (filter.style.saturate !== undefined) parts.push(`saturate(${filter.style.saturate})`)
    if (filter.style.sepia !== undefined) parts.push(`sepia(${filter.style.sepia})`)
    if (filter.style.hueRotate !== undefined) parts.push(`hue-rotate(${filter.style.hueRotate}deg)`)
    if (filter.style.contrast !== undefined) parts.push(`contrast(${filter.style.contrast})`)
    if (filter.style.brightness !== undefined) parts.push(`brightness(${filter.style.brightness})`)

    return parts.join(' ')
  }, [])

  return {
    cameraPermission,
    micPermission,
    mediaPermission,
    requestPermissions,
    saveToGallery,
    pickFromGallery,
    applyFilter,
  }
}
