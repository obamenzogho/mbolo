/* src/features/create/hooks/useCreatePublish.ts

   Publication du nouveau flux unifié. Point unique d'écriture :
   - vidéo → collection `videos` (createVideo) ;
   - photo / texte → collection `posts` (createPost, sans les modes riches
     abandonnés : pas de sondage, article, fond de texte, partage vidéo).

   Les uploads passent par Cloudinary (uploadToCloudinary) ; les erreurs sont
   distinguées (upload / write / render / rateLimit) et le cooldown entre deux
   créations est le même que celui de l'ancien composeur. */

import { useCallback, useRef } from 'react'
import { uploadToCloudinary, generateThumbnailURL } from '@/lib/cloudinary'
import { captureException } from '@/lib/sentry'
import {
  createPost,
  extractHashtags,
  loadPostAuthor,
  type PostAuthor,
} from '@/features/news/services/postMutations'
import type { NewsPostMedia } from '@/features/news/types'
import { createVideo } from '../services/videoMutations'
import type { CreateDraft } from '../types'

/** 15 s entre deux créations : garde-fou applicatif (le serveur garde le sien). */
const PUBLISH_COOLDOWN_MS = 15_000

export type CreatePublishError = 'upload' | 'write' | 'auth' | 'render' | 'rateLimit'

export interface CreateResult {
  kind: 'post' | 'video'
  id: string
}

export interface CreateAuthor {
  uid: string
  displayName: string
}

interface PublishOptions {
  onProgress?: (progress: number) => void
}

/** Succès `{ kind, id }`, ou la raison d'échec. */
export type CreatePublishOutcome = CreateResult | CreatePublishError

export function useCreatePublish() {
  const lastPublishAt = useRef(0)

  const publish = useCallback(
    async (
      draft: CreateDraft,
      author: CreateAuthor,
      options: PublishOptions = {},
    ): Promise<CreatePublishOutcome> => {
      if (!author.uid) return 'auth'

      const now = Date.now()
      if (now - lastPublishAt.current < PUBLISH_COOLDOWN_MS) {
        return 'rateLimit'
      }

      const step = (progress: number) => options.onProgress?.(progress)

      /* Un seul média vidéo → le feed vidéo (collection `videos`). */
      if (draft.media.length === 1 && draft.media[0].type === 'video') {
        try {
          const video = draft.media[0]
          const videoUrl = await uploadToCloudinary(video.uri, 'video', {
            folder: 'reels',
            timeout: 180000,
            onProgress: (p) => step(0.15 + p * 0.6),
          })
          if (!videoUrl) return 'upload'
          step(0.8)

          const postAuthor = await loadPostAuthor(author.uid, author.displayName)

          const id = await createVideo({
            userId: author.uid,
            userName: postAuthor.userName,
            userPhotoURL: postAuthor.userPhotoURL || undefined,
            videoURL: videoUrl,
            thumbnailURL: generateThumbnailURL(videoUrl) || undefined,
            description: draft.text.trim(),
            hashtags: extractHashtags(draft.text),
            visibility: draft.visibility,
            commentsEnabled: draft.commentsEnabled,
            place: draft.location?.name,
            lat: draft.location?.lat,
            lng: draft.location?.lng,
            soundId: draft.soundId,
          })

          if (!id) return 'write'
          step(1)
          lastPublishAt.current = Date.now()
          return { kind: 'video', id }
        } catch (error) {
          captureException(
            error instanceof Error ? error : new Error(String(error)),
            { context: 'news.create.publishVideo' },
          )
          return 'upload'
        }
      }

      /* Photo / texte → collection `posts`. */
      try {
        const media: NewsPostMedia[] = []
        for (const item of draft.media) {
          const url = await uploadToCloudinary(item.uri, 'image', {
            timeout: 120000,
            onProgress: (p) =>
              step(
                (draft.media.length > 0
                  ? p / draft.media.length
                  : 0) * 0.6,
              ),
          })
          if (!url) return 'upload'
          media.push({
            url,
            type: 'image',
            width: item.width,
            height: item.height,
          })
        }
        step(0.75)

        const postAuthor = await loadPostAuthor(author.uid, author.displayName)

        const id = await createPost(postAuthor, {
          text: draft.text.trim(),
          format: draft.media.length === 0 ? 'text' : draft.media.length === 1 ? 'image' : 'carousel',
          media,
          visibility: draft.visibility,
          commentsEnabled: draft.commentsEnabled,
          background: 'none',
          location: draft.location,
          mood: null,
          poll: null,
          article: null,
          videoShare: null,
        })

        if (!id) return 'write'
        step(1)
        lastPublishAt.current = Date.now()
        return { kind: 'post', id }
      } catch (error) {
        captureException(
          error instanceof Error ? error : new Error(String(error)),
          { context: 'news.create.publishPost' },
        )
        return 'upload'
      }
    },
    [],
  )

  return { publish }
}

export type { PostAuthor }
