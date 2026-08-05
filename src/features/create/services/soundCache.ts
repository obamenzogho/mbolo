/* soundCache.ts — Récupération locale d'une piste de la bibliothèque.

   FFmpeg ne lit que des fichiers locaux : le son choisi doit être descendu
   avant le rendu. Le cache est adressé par soundId, donc republier avec la
   même musique ne retélécharge pas. */

import * as FileSystem from 'expo-file-system/legacy'
import { captureException } from '@/lib/sentry'

export const SOUND_CACHE_DIR = `${FileSystem.cacheDirectory}mbolo-sounds/`

const ALLOWED_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg'] as const

/* Le soundId vient de Firestore : il est assaini pour ne jamais pouvoir
   composer un chemin hors du dossier de cache. */
export function buildSoundCachePath(soundId: string, audioURL: string): string {
  const safeId = soundId.replace(/[^a-zA-Z0-9_-]/g, '')
  const extension = audioURL.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const safeExtension = (ALLOWED_EXTENSIONS as readonly string[]).includes(extension)
    ? extension
    : 'mp3'

  return `${SOUND_CACHE_DIR}${safeId}.${safeExtension}`
}

async function ensureDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(SOUND_CACHE_DIR)
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SOUND_CACHE_DIR, { intermediates: true })
  }
}

/** Retourne l'URI locale du son, ou null si le téléchargement échoue. */
export async function ensureLocalSound(
  soundId: string,
  audioURL: string,
): Promise<string | null> {
  if (!soundId || !audioURL) return null

  try {
    await ensureDirectory()
    const target = buildSoundCachePath(soundId, audioURL)

    const existing = await FileSystem.getInfoAsync(target)
    if (existing.exists) return target

    const { uri } = await FileSystem.downloadAsync(audioURL, target)
    return uri
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'create.sound.ensureLocalSound',
      soundId,
    })
    return null
  }
}

export async function clearSoundCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(SOUND_CACHE_DIR, { idempotent: true })
  } catch (error) {
    console.warn('[soundCache] Nettoyage du cache impossible:', error)
  }
}
