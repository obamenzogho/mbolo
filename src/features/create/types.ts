/* src/features/create/types.ts

   Types du nouveau flux de création unifié (post / vidéo).
   Le médium porté depuis le prototype createPost-instagram est en P2/P3 ;
   ici ne vit que ce dont le socle a besoin. `SelectedMedia` est partagé avec
   le module compose (galerie / caméra). */

import type { NewsLocation, NewsPostVisibility } from '@/features/news/types'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'

/** Limite produit du carrousel photo. Une vidéo reste toujours seule. */
export const CREATE_MAX_MEDIA = 4

/** Brouillon du nouveau flux : texte + média (photo ou vidéo) + réglages. */
export interface CreateDraft {
  text: string
  media: SelectedMedia[]
  visibility: NewsPostVisibility
  commentsEnabled: boolean
  location: NewsLocation | null
  soundId?: string
}

/** Un seul média, et il est vidéo ? La vidéo part dans `videos`. */
export function isVideoOnly(draft: CreateDraft): boolean {
  return draft.media.length === 1 && draft.media[0].type === 'video'
}
