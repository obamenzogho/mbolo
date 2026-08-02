/* src/features/news/hooks/useComposePublish.ts

   Publication : transforme l'état local du composeur en document Firestore.

   Toute la partie coûteuse est ici — les URI locales (`file://`) doivent
   devenir des URL Cloudinary avant l'écriture, sinon le document contient
   des chemins qui n'existent que sur l'appareil de l'auteur.

   La progression est calculée sur le nombre d'uploads, pas sur les octets :
   Cloudinary ne remonte pas d'avancement par fichier ici, et une barre qui
   avance par paliers reste plus honnête qu'une barre simulée. */

import { useCallback, useRef, useState } from 'react'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { captureException } from '@/lib/sentry'
import {
  createPost,
  loadPostAuthor,
  updatePost,
  type PostAuthor,
  type PostDraft,
} from '../services/postMutations'
import type { NewsPostMedia } from '../types'
import { inferFormat, type ComposeState } from './useComposeState'

/** Une URL déjà hébergée ne doit pas être renvoyée sur Cloudinary en édition. */
function isRemote(uri: string): boolean {
  return /^https?:/.test(uri)
}

/** Une vidéo de plusieurs minutes en réseau mobile dépasse le délai par défaut. */
const UPLOAD_TIMEOUT_MS = 180_000

/** Délai minimal entre deux publications : garde-fou applicatif, complément
    du quota serveur (functions/src/posts/onPostCreate.ts). */
const POST_PUBLISH_MIN_INTERVAL_MS = 15_000

export type PublishError = 'upload' | 'write' | 'auth' | 'rateLimit'

interface UseComposePublishOptions {
  /** Renseigné en édition : bascule vers updatePost. */
  postId?: string
  onSuccess: (postId: string, draft: PostDraft) => void
  onError: (reason: PublishError) => void
}

export function useComposePublish({ postId, onSuccess, onError }: UseComposePublishOptions) {
  const [publishing, setPublishing] = useState(false)
  const [progress, setProgress] = useState(0)

  // Garde-fou contre le double-tap sur « Publier » : l'état React n'est pas
  // encore à jour au second appui synchrone.
  const busy = useRef(false)

  /** Date de la dernière publication réussie (cooldown anti-spam). */
  const lastPublishAt = useRef(0)

  const publish = useCallback(
    async (state: ComposeState, author: { uid: string; displayName: string } | null) => {
      if (busy.current) return
      if (!author) {
        onError('auth')
        return
      }

      // Anti-spam applicatif : espacement minimal entre deux publications.
      // Ne s'applique qu'à la création — éditer son post n'est pas spammer.
      if (!postId) {
        const sinceLast = Date.now() - lastPublishAt.current
        if (sinceLast < POST_PUBLISH_MIN_INTERVAL_MS) {
          onError('rateLimit')
          return
        }
      }

      busy.current = true
      setPublishing(true)
      setProgress(0)

      try {
        /* Un upload par média, plus la couverture d'article le cas échéant. */
        const localMedia = state.media.filter((item) => !isRemote(item.uri))
        const needsCover = Boolean(
          state.article?.coverImage && !isRemote(state.article.coverImage),
        )
        const totalSteps = localMedia.length + (needsCover ? 1 : 0) + 1
        let done = 0

        const step = () => {
          done += 1
          setProgress(Math.round((done / totalSteps) * 100))
        }

        /* Progression fine d'un upload : la part déjà franchie plus
           l'avancement du fichier courant, borné à 99 % — le 100 % est
           réservé à l'écriture Firestore réussie. */
        const stepProgress = (ratio: number) => {
          setProgress(Math.min(99, Math.round(((done + ratio) / totalSteps) * 100)))
        }

        const media: NewsPostMedia[] = []

        for (const item of state.media) {
          const url = isRemote(item.uri)
            ? item.uri
            : await uploadToCloudinary(item.uri, item.type, {
                compress: item.type === 'image',
                timeout: UPLOAD_TIMEOUT_MS,
                onProgress: (value) => stepProgress(value / 100),
              })

          /* La vignette est un confort d'affichage : si son upload échoue,
             la carte retombe sur l'URL de la vidéo plutôt que d'échouer. */
          let thumbnailUrl: string | undefined
          if (item.type === 'video' && item.thumbnailUri && !isRemote(item.thumbnailUri)) {
            thumbnailUrl = await uploadToCloudinary(item.thumbnailUri, 'image', {
              compress: true,
            }).catch((error) => {
              captureException(
                error instanceof Error ? error : new Error(String(error)),
                { context: 'news.compose.thumbnail' },
              )
              return undefined
            })
          } else if (item.thumbnailUri) {
            thumbnailUrl = item.thumbnailUri
          }

          media.push({
            url,
            type: item.type,
            width: item.width,
            height: item.height,
            duration: item.duration ?? undefined,
            thumbnailUrl,
          })

          if (!isRemote(item.uri)) step()
        }

        let article: PostDraft['article'] = null
        if (state.article) {
          const cover = state.article.coverImage
          const coverImage =
            cover && !isRemote(cover)
              ? await uploadToCloudinary(cover, 'image', { compress: true })
              : cover ?? undefined

          if (needsCover) step()

          article = {
            title: state.article.title.trim(),
            // L'extrait alimente la carte du fil : dérivé du corps, jamais saisi.
            excerpt: state.article.body.trim().slice(0, 180),
            body: state.article.body.trim(),
            coverImage,
          }
        }

        /* Les options vides sont retirées : l'éditeur en propose plus que ce
           que l'utilisateur remplit souvent. */
        const poll = state.poll
          ? {
              question: state.poll.question.trim(),
              options: state.poll.options
                .filter((option) => option.text.trim())
                .map((option) => ({ ...option, text: option.text.trim() })),
            }
          : null

        const draft: PostDraft = {
          text: state.text,
          format: inferFormat(state),
          media,
          visibility: state.visibility,
          commentsEnabled: state.commentsEnabled,
          background: state.background,
          location: state.location,
          mood: state.mood,
          poll,
          article,
          videoShare: state.sharedVideo,
        }

        /* Phase d'écriture isolée : seuls les uploads échouent en 'upload',
           un rejet réseau ici (loadPostAuthor lit Firestore) est un échec
           d'écriture, le message doit le dire. */
        try {
          if (postId) {
            const updated = await updatePost(postId, draft)
            step()

            if (updated) {
              lastPublishAt.current = Date.now()
              onSuccess(postId, draft)
            } else onError('write')
            return
          }

          const postAuthor: PostAuthor = await loadPostAuthor(author.uid, author.displayName)
          const createdId = await createPost(postAuthor, draft)
          step()

          if (createdId) {
            lastPublishAt.current = Date.now()
            onSuccess(createdId, draft)
          } else onError('write')
        } catch (error) {
          captureException(
            error instanceof Error ? error : new Error(String(error)),
            { context: 'news.compose.publishWrite', postId: postId ?? 'new' },
          )
          onError('write')
        }
      } catch (error) {
        captureException(
          error instanceof Error ? error : new Error(String(error)),
          { context: 'news.compose.publish', postId: postId ?? 'new' },
        )
        onError('upload')
      } finally {
        busy.current = false
        setPublishing(false)
        setProgress(0)
      }
    },
    [postId, onSuccess, onError],
  )

  return { publish, publishing, progress }
}
