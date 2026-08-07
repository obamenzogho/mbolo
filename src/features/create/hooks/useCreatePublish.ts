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
  updatePost,
  extractHashtags,
  loadPostAuthor,
  type PostAuthor,
} from '@/features/news/services/postMutations'
import type { NewsPostMedia } from '@/features/news/types'
import { createVideo, updateVideo } from '../services/videoMutations'
import { incrementSoundUsage, loadSoundById } from '../services/soundService'
import { ensureLocalSound } from '../services/soundCache'
import type { CreateDraft } from '../types'
import { renderMedia, clearRenderCache, cancelRender } from '../utils/renderMedia'

/** 15 s entre deux créations : garde-fou applicatif (le serveur garde le sien). */
const PUBLISH_COOLDOWN_MS = 15_000

export type CreatePublishError = 'upload' | 'write' | 'auth' | 'render' | 'rateLimit' | 'cancelled'

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

export interface EditTarget {
  kind: 'post' | 'video'
  id: string
}

export type UpdateOutcome =
  | CreateResult
  | CreatePublishError

export function useCreatePublish() {
  const lastPublishAt = useRef(0)
  /* Annulation : le geste utilisateur pose le drapeau, coupe le rendu FFmpeg
     en cours et abat l'upload Cloudinary. Le brouillon est conservé. */
  const cancelledRef = useRef(false)
  const renderSessionRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    cancelledRef.current = true
    if (renderSessionRef.current != null) {
      cancelRender(renderSessionRef.current)
      renderSessionRef.current = null
    }
    abortRef.current?.abort()
  }, [])

  /* Nouvelle tentative (ou nouvelle publication) : rejoue propre. */
  const beginPublish = useCallback((): AbortSignal => {
    cancelledRef.current = false
    abortRef.current = new AbortController()
    return abortRef.current.signal
  }, [])

  /* Retourne 'cancelled' si l'utilisateur a annulé entre deux étapes. */
  const isCancelled = useCallback((): CreatePublishError | null => {
    return cancelledRef.current ? 'cancelled' : null
  }, [])

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

      const signal = beginPublish()
      const step = (progress: number) => options.onProgress?.(progress)

      /* Un seul média vidéo → le feed vidéo (collection `videos`). */
      if (draft.media.length === 1 && draft.media[0].type === 'video') {
        try {
          const video = draft.media[0]

          /* Le son choisi doit être local avant le rendu : FFmpeg ne lit pas
             une URL distante. Un échec de téléchargement ne bloque pas la
             publication, la vidéo garde alors son audio d'origine. */
          let soundUri: string | null = null
          if (draft.soundId) {
            const sound = await loadSoundById(draft.soundId)
            if (sound?.audioURL) {
              soundUri = await ensureLocalSound(sound.id, sound.audioURL)
            }
          }
          if (isCancelled()) return 'cancelled'

          /* Rendu local (trim + filtres + overlays) avant l'upload : 0→15% de la
             barre de progression, l'upload prend les 60% suivants. */
          const rendered = await renderMedia(video, {
            overlayUri: video.overlayUri ?? null,
            soundUri,
            onProgress: (p) => step(p * 0.15),
            onSession: (sessionId) => {
              renderSessionRef.current = sessionId
            },
          })
          if (isCancelled()) return 'cancelled'

          const videoUrl = await uploadToCloudinary(rendered.uri, 'video', {
            folder: 'reels',
            timeout: 180000,
            signal,
            onProgress: (p) => step(0.15 + p * 0.6),
          })
          if (!videoUrl) return 'upload'
          if (isCancelled()) return 'cancelled'
          step(0.8)

          const postAuthor = await loadPostAuthor(author.uid, author.displayName)

          /* renderVideo a déjà trimé la vidéo : la couverture choisie
             dans l'original doit être recalée sur le clip final, sinon
             la vignette pointe vers le mauvais instant. */
          const cover = Math.max(
            0,
            (video.video?.coverTime ?? 1000) - (video.video?.trimStart ?? 0),
          )

          const id = await createVideo({
            userId: author.uid,
            userName: postAuthor.userName,
            userPhotoURL: postAuthor.userPhotoURL || undefined,
            videoURL: videoUrl,
            thumbnailURL: generateThumbnailURL(videoUrl, { startOffset: cover / 1000 }) || undefined,
            description: draft.text.trim(),
            hashtags: extractHashtags(draft.text),
            visibility: draft.visibility,
            commentsEnabled: draft.commentsEnabled,
            hideMentionsAndHashtags: draft.hideMentionsAndHashtags,
            place: draft.location?.name,
            lat: draft.location?.lat,
            lng: draft.location?.lng,
            soundId: draft.soundId,
            durationMs: video.duration ?? undefined,
          })

          if (!id) return 'write'
          step(1)
          if (draft.soundId) {
            void incrementSoundUsage(draft.soundId)
          }
          lastPublishAt.current = Date.now()
          void clearRenderCache()
          return { kind: 'video', id }
        } catch (error) {
          if (isCancelled()) return 'cancelled'
          captureException(
            error instanceof Error ? error : new Error(String(error)),
            { context: 'news.create.publishVideo' },
          )
          return 'upload'
        }
      }

      /* Photo / texte → collection `posts`. Un carrousel peut contenir des
         vidéos (homogène) : chaque item est rendu puis uploadé selon son type. */
      try {
        const media: NewsPostMedia[] = []
        for (const item of draft.media) {
          const isVideo = item.type === 'video'
          const rendered = await renderMedia(item, { overlayUri: item.overlayUri ?? null })

          if (isCancelled()) return 'cancelled'

          const url = await uploadToCloudinary(rendered.uri, isVideo ? 'video' : 'image', {
            timeout: isVideo ? 180000 : 120000,
            signal,
            onProgress: (p) => step((draft.media.length > 0 ? p / draft.media.length : 0) * 0.6),
          })
          if (!url) return 'upload'
          media.push({
            url,
            type: isVideo ? 'video' : 'image',
            width: rendered.width,
            height: rendered.height,
            duration: isVideo ? item.duration ?? undefined : undefined,
            altText: item.altText,
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
          hideMentionsAndHashtags: draft.hideMentionsAndHashtags,
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
        void clearRenderCache()
        return { kind: 'post', id }
      } catch (error) {
        if (isCancelled()) return 'cancelled'
        captureException(
          error instanceof Error ? error : new Error(String(error)),
          { context: 'news.create.publishPost' },
        )
        return 'upload'
      }
    },
    [beginPublish, isCancelled],
  )

  const update = useCallback(
    async (
      target: EditTarget,
      draft: CreateDraft,
      author: CreateAuthor,
      options: PublishOptions = {},
    ): Promise<UpdateOutcome> => {
      if (!author.uid) return 'auth'

      const signal = beginPublish()
      const step = (progress: number) => {
        options.onProgress?.(progress)
      }

      if (target.kind === 'video') {
        const media = draft.media[0]

        if (!media || media.type !== 'video') {
          return 'write'
        }

        let rendered

        try {
          let soundUri: string | null = null
          if (draft.soundId) {
            const sound = await loadSoundById(draft.soundId)
            if (sound?.audioURL) {
              soundUri = await ensureLocalSound(sound.id, sound.audioURL)
            }
          }

          rendered = await renderMedia(media, {
            overlayUri: media.overlayUri ?? null,
            soundUri,
            onProgress: (progress) => step(progress * 0.25),
            onSession: (sessionId) => {
              renderSessionRef.current = sessionId
            },
          })
        } catch {
          return isCancelled() ?? 'render'
        }

        let videoURL: string | null = null

        try {
          videoURL = await uploadToCloudinary(rendered.uri, 'video', {
            folder: 'reels',
            timeout: 180000,
            signal,
            onProgress: (progress) => {
              step(0.25 + progress * 0.6)
            },
          })
        } catch {
          return isCancelled() ?? 'upload'
        }

        if (!videoURL) return 'upload'
        if (isCancelled()) return 'cancelled'

        const trimStart = media.video?.trimStart ?? 0
        const coverTime = Math.max(
          0,
          (media.video?.coverTime ?? 1000) - trimStart,
        )

        const thumbnailURL =
          generateThumbnailURL(videoURL, {
            startOffset: coverTime / 1000,
          }) || undefined

        const updated = await updateVideo(target.id, {
          videoURL,
          thumbnailURL,
          description: draft.text.trim(),
          hashtags: extractHashtags(draft.text),
          visibility: draft.visibility,
          commentsEnabled: draft.commentsEnabled,
          hideMentionsAndHashtags: draft.hideMentionsAndHashtags,
          soundId: draft.soundId,
          durationMs: media.duration ?? undefined,
        })

        if (!updated) return 'write'

        step(1)

        return {
          kind: 'video',
          id: target.id,
        }
      }

      const renderedMedia: NewsPostMedia[] = []

      for (const item of draft.media) {
        let rendered

        try {
          rendered = await renderMedia(item, {
            overlayUri: item.overlayUri ?? null,
            onProgress: (progress) => step(progress * 0.5),
          })
        } catch {
          return isCancelled() ?? 'render'
        }

        let url: string | null = null

        try {
          url = await uploadToCloudinary(rendered.uri, 'image', {
            signal,
            onProgress: (progress) => step(0.5 + progress * 0.4),
          })
        } catch {
          return isCancelled() ?? 'upload'
        }

        if (!url) return 'upload'

        renderedMedia.push({
          url,
          type: 'image',
          width: rendered.width,
          height: rendered.height,
        })
      }

      const updated = await updatePost(target.id, {
        text: draft.text.trim(),
        format:
          renderedMedia.length === 0
            ? 'text'
            : renderedMedia.length === 1
              ? 'image'
              : 'carousel',
        media: renderedMedia,
        visibility: draft.visibility,
        commentsEnabled: draft.commentsEnabled,
        hideMentionsAndHashtags: draft.hideMentionsAndHashtags,
        background: 'none',
        location: draft.location,
        mood: null,
        poll: null,
        article: null,
        videoShare: null,
      })

      if (!updated) return 'write'

      step(1)

      return {
        kind: 'post',
        id: target.id,
      }
    },
    [beginPublish, isCancelled],
  )

  return { publish, update, cancel }
}

export type { PostAuthor }
