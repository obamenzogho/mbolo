/* cameraRoll.ts — Sauvegarde d'une prise dans la pellicule du téléphone.

   Wrapper expo-media-library : permission demandée à la première sauvegarde,
   refus → false (le flux de création continue, jamais bloqué). L'écriture
   est best-effort : un échec disque est loggé et signalé, pas levé. */

import { Platform } from 'react-native'
import * as MediaLibrary from 'expo-media-library'
import { captureException } from '@/lib/sentry'

export type SaveToLibraryResult = 'saved' | 'denied' | 'failed'

/* La rafale sauvegarde plusieurs clichés en parallèle : une demande de
   permission par cliché ouvrirait N dialogs système. Une seule requête
   est partagée par toutes les sauvegardes concurrentes. */
let permissionRequest: ReturnType<typeof MediaLibrary.requestPermissionsAsync> | null = null

async function ensureLibraryPermission(): Promise<MediaLibrary.PermissionResponse> {
  const current = await MediaLibrary.getPermissionsAsync()
  if (current.granted) return current

  if (!permissionRequest) {
    permissionRequest = MediaLibrary.requestPermissionsAsync().finally(() => {
      permissionRequest = null
    })
  }
  return permissionRequest
}

/** Copie un fichier local (photo ou vidéo) dans la pellicule.
    Retourne l'issue pour que l'app puisse désactiver la préférence en cas
    de refus persistant — sans jamais interrompre la capture. */
export async function saveMediaToLibrary(localUri: string): Promise<SaveToLibraryResult> {
  if (Platform.OS === 'web') return 'denied'

  try {
    const permission = await ensureLibraryPermission()
    if (!permission.granted) return 'denied'

    await MediaLibrary.saveToLibraryAsync(localUri)
    return 'saved'
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'create.camera.saveToLibrary',
      uri: localUri,
    })
    return 'failed'
  }
}
