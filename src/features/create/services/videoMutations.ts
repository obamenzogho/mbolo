/* src/features/create/services/videoMutations.ts

   Écritures Firestore de la collection `videos` pour le nouveau flux de
   création unifié. Aucun composant n'écrit directement : tout passe par ici.

   Adapté du legacy `video-editor` (supprimé), aligné sur les conventions de
   `postMutations` (mêmes noms de champs, mêmes agrégats initiaux). Le
   `videoURL` est un fichier rendu (ffmpeg) uploadé sur Cloudinary : le feed
   n'applique aucun montage à la lecture. */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
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
