/* src/features/create/services/videoMutations.ts

   Écritures Firestore de la collection `videos` pour le nouveau flux de
   création unifié. Aucun composant n'écrit directement : tout passe par ici.

   Adapté du legacy `video-editor` (supprimé), aligné sur les conventions de
   `postMutations` (mêmes noms de champs, mêmes agrégats initiaux). Le
   `videoURL` est un fichier rendu (ffmpeg) uploadé sur Cloudinary : le feed
   n'applique aucun montage à la lecture. */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import type { NewsPostVisibility } from '@/features/news/types'

/** Contenu d'une vidéo à publier dans le feed vidéo. */
export interface VideoDraft {
  userId: string
  userName: string
  userPhotoURL?: string
  /** URL Cloudinary du fichier rendu (mp4). */
  videoURL: string
  thumbnailURL?: string
  coverURL?: string
  description: string
  hashtags: string[]
  visibility: NewsPostVisibility
  commentsEnabled: boolean
  durationMs?: number
  place?: string
  lat?: number
  lng?: number
  geohash?: string
  soundId?: string
}

/**
 * Publie une vidéo. Retourne l'id créé, ou null sur échec (capturé ici,
 * jamais de rejet) — l'appelant affiche son erreur générique.
 */
export async function createVideo(draft: VideoDraft): Promise<string | null> {
  try {
    const created = await addDoc(collection(db, 'videos'), {
      ...draft,
      type: 'video',
      // Agrégats initialisés à zéro, possédés ensuite par les Cloud Functions.
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      reposts: 0,
      views: 0,
      savedBy: [],
      createdAt: serverTimestamp(),
    })
    return created.id
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      { context: 'news.createVideo' },
    )
    return null
  }
}

export interface VideoUpdateDraft {
  videoURL?: string
  thumbnailURL?: string
  coverURL?: string
  description: string
  hashtags: string[]
  visibility: NewsPostVisibility
  commentsEnabled: boolean
  place?: string
  lat?: number
  lng?: number
  geohash?: string
  soundId?: string
  durationMs?: number
}

export interface StoredVideo {
  id: string
  userId: string
  videoURL: string
  thumbnailURL?: string
  coverURL?: string
  description: string
  hashtags: string[]
  visibility: NewsPostVisibility
  commentsEnabled: boolean
  durationMs?: number
  soundId?: string
}

export async function loadVideo(
  videoId: string,
): Promise<StoredVideo | null> {
  try {
    const snapshot = await getDoc(doc(db, 'videos', videoId))

    if (!snapshot.exists()) return null

    const data = snapshot.data()

    return {
      id: snapshot.id,
      userId: data.userId,
      videoURL: data.videoURL,
      thumbnailURL: data.thumbnailURL,
      coverURL: data.coverURL,
      description: data.description ?? '',
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
      visibility: data.visibility ?? 'public',
      commentsEnabled: data.commentsEnabled !== false,
      durationMs: data.durationMs,
      soundId: data.soundId,
    }
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      { context: 'news.loadVideo', videoId },
    )

    return null
  }
}

export async function updateVideo(
  videoId: string,
  draft: VideoUpdateDraft,
): Promise<boolean> {
  try {
    const fields = Object.fromEntries(
      Object.entries({
        ...draft,
        updatedAt: serverTimestamp(),
      }).filter(([, value]) => value !== undefined),
    )

    await updateDoc(doc(db, 'videos', videoId), fields)

    return true
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      { context: 'news.updateVideo', videoId },
    )

    return false
  }
}
