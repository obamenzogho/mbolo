/* src/features/news/hooks/useComposeState.ts

   État du composeur : une seule source de vérité pour un écran qui produit
   cinq formes de publication (texte, média, article, sondage, partage vidéo).

   Pourquoi un reducer plutôt que quinze useState : les modes s'excluent
   mutuellement et se nettoient l'un l'autre. Ouvrir un sondage doit retirer
   les médias, choisir un fond doit fermer l'article. Avec des états séparés,
   cette cohérence se disperse dans les gestionnaires d'événements et finit
   par diverger — c'est l'origine des incohérences de la version précédente. */

import { useCallback, useMemo, useReducer } from 'react'
import {
  COMPOSE_MAX_MEDIA,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
} from '../theme/postTokens'
import type {
  NewsLocation,
  NewsMood,
  NewsPoll,
  NewsPostFormat,
  NewsPostVideoShare,
  NewsPostVisibility,
  PostBackgroundId,
} from '../types'

export interface SelectedMedia {
  uri: string
  type: 'image' | 'video'
  width?: number
  height?: number
  duration?: number | null
  /** Vignette locale : l'URI d'une vidéo ne s'affiche pas dans <Image>. */
  thumbnailUri?: string

  /* ── Champs d'édition (optionnels, portés du prototype createPost-instagram) ──
     Les anciens chemins (caméra, composeur riche) ne les remplissent pas :
     valeur par défaut = pas d'édition. Voir src/features/create/types/editing.ts
     pour les types complets. */

  /** Paramètres de recadrage / rotation. */
  crop?: {
    aspect: number   // 0 = original, 1 = carré, 0.8 = 4:5…
    rotation: number // degrés (straighten + increments 90°)
    flipH: boolean
    flipV: boolean
    cropX: number    // 0-1, position X du centre (0.5 = centré)
    cropY: number    // 0-1, position Y du centre (0.5 = centré)
  }
  /** Transformation de l'image pendant le recadrage (pan/zoom). */
  cropTransform?: {
    scale: number
    translateX: number
    translateY: number
  }
  /** Filtre Instagram appliqué (id du filtre, ex 'clarendon'). */
  filterId?: string
  /** Intensité du filtre (0-100). */
  filterIntensity?: number
  /** Ajustements manuels (brightness, contrast, etc.). */
  adjustments?: {
    brightness: number
    contrast: number
    saturation: number
    warmth: number
    fade: number
    highlights: number
    shadows: number
    tint: number
    sharpen: number
    vignette: number
  }
  /** Effet appliqué (id, ex 'ef-vintage'). */
  effectId?: string
  /** Intensité de l'effet (0-100). */
  effectIntensity?: number
  /** Overlays texte, sticker, dessin. */
  overlay?: Array<
    | { id: string; kind: 'stroke'; points: { x: number; y: number }[]; color: string; size: number }
    | { id: string; kind: 'text'; text: string; x: number; y: number; color: string; fontId: string; size: number }
    | { id: string; kind: 'sticker'; emoji: string; x: number; y: number; scale: number }
  >
}

export interface ComposeState {
  text: string
  media: SelectedMedia[]
  visibility: NewsPostVisibility
  commentsEnabled: boolean
  background: PostBackgroundId
  location: NewsLocation | null
  mood: NewsMood | null
  poll: NewsPoll | null
  article: { title: string; body: string; coverImage: string | null } | null
  sharedVideo: NewsPostVideoShare | null
}

export const EMPTY_COMPOSE: ComposeState = {
  text: '',
  media: [],
  visibility: 'public',
  commentsEnabled: true,
  background: 'none',
  location: null,
  mood: null,
  poll: null,
  article: null,
  sharedVideo: null,
}

function emptyPoll(): NewsPoll {
  return {
    question: '',
    options: Array.from({ length: POLL_MIN_OPTIONS }, (_, index) => ({
      id: `opt-${index}`,
      text: '',
      votes: 0,
      votedBy: [] as string[],
    })),
  }
}

export type ComposeAction =
  | { type: 'reset' }
  | { type: 'hydrate'; state: ComposeState }
  | { type: 'setText'; text: string }
  | { type: 'setVisibility'; visibility: NewsPostVisibility }
  | { type: 'toggleComments' }
  | { type: 'setBackground'; background: PostBackgroundId }
  | { type: 'setLocation'; location: NewsLocation | null }
  | { type: 'setMood'; mood: NewsMood | null }
  | { type: 'addMedia'; media: SelectedMedia[] }
  | { type: 'setMediaThumbnail'; uri: string; thumbnailUri: string }
  | { type: 'removeMedia'; uri: string }
  | { type: 'openPoll' }
  | { type: 'setPollQuestion'; question: string }
  | { type: 'setPollOption'; id: string; text: string }
  | { type: 'addPollOption' }
  | { type: 'removePollOption'; id: string }
  | { type: 'closePoll' }
  | { type: 'openArticle' }
  | { type: 'setArticleTitle'; title: string }
  | { type: 'setArticleBody'; body: string }
  | { type: 'setArticleCover'; coverImage: string | null }
  | { type: 'closeArticle' }
  | { type: 'setSharedVideo'; video: NewsPostVideoShare | null }

/* Un fond de couleur n'a de sens que sur un post texte seul : dès qu'un
   média, un sondage, un article ou une vidéo entre, il est retiré. */
function withoutBackground(state: ComposeState): ComposeState {
  return state.background === 'none' ? state : { ...state, background: 'none' }
}

export function composeReducer(state: ComposeState, action: ComposeAction): ComposeState {
  switch (action.type) {
    case 'reset':
      return EMPTY_COMPOSE

    case 'hydrate':
      return action.state

    case 'setText':
      return { ...state, text: action.text }

    case 'setVisibility':
      return { ...state, visibility: action.visibility }

    case 'toggleComments':
      return { ...state, commentsEnabled: !state.commentsEnabled }

    case 'setBackground':
      return { ...state, background: action.background }

    case 'setLocation':
      return { ...state, location: action.location }

    case 'setMood':
      return { ...state, mood: action.mood }

    case 'addMedia': {
      // Une vidéo occupe la publication entière : mélanger vidéo et photos
      // produirait une grille dont le lecteur ne sait pas quoi faire.
      const incomingVideo = action.media.find((item) => item.type === 'video')

      if (incomingVideo) {
        return withoutBackground({
          ...state,
          media: [incomingVideo],
          poll: null,
          article: null,
          sharedVideo: null,
        })
      }

      const images = [...state.media.filter((item) => item.type === 'image'), ...action.media]

      return withoutBackground({
        ...state,
        media: images.slice(0, COMPOSE_MAX_MEDIA),
        poll: null,
        article: null,
        sharedVideo: null,
      })
    }

    case 'setMediaThumbnail':
      return {
        ...state,
        media: state.media.map((item) =>
          item.uri === action.uri ? { ...item, thumbnailUri: action.thumbnailUri } : item,
        ),
      }

    case 'removeMedia':
      return { ...state, media: state.media.filter((item) => item.uri !== action.uri) }

    case 'openPoll':
      return withoutBackground({
        ...state,
        poll: state.poll ?? emptyPoll(),
        media: [],
        article: null,
        sharedVideo: null,
      })

    case 'setPollQuestion':
      return state.poll
        ? { ...state, poll: { ...state.poll, question: action.question } }
        : state

    case 'setPollOption':
      return state.poll
        ? {
            ...state,
            poll: {
              ...state.poll,
              options: state.poll.options.map((option) =>
                option.id === action.id ? { ...option, text: action.text } : option,
              ),
            },
          }
        : state

    case 'addPollOption':
      return state.poll && state.poll.options.length < POLL_MAX_OPTIONS
        ? {
            ...state,
            poll: {
              ...state.poll,
              options: [
                ...state.poll.options,
                {
                  id: `opt-${state.poll.options.length}-${state.poll.options.length}`,
                  text: '',
                  votes: 0,
                  votedBy: [],
                },
              ],
            },
          }
        : state

    case 'removePollOption':
      return state.poll && state.poll.options.length > POLL_MIN_OPTIONS
        ? {
            ...state,
            poll: {
              ...state.poll,
              options: state.poll.options.filter((option) => option.id !== action.id),
            },
          }
        : state

    case 'closePoll':
      return { ...state, poll: null }

    case 'openArticle':
      return withoutBackground({
        ...state,
        article: state.article ?? { title: '', body: '', coverImage: null },
        poll: null,
        sharedVideo: null,
      })

    case 'setArticleTitle':
      return state.article
        ? { ...state, article: { ...state.article, title: action.title } }
        : state

    case 'setArticleBody':
      return state.article
        ? { ...state, article: { ...state.article, body: action.body } }
        : state

    case 'setArticleCover':
      return state.article
        ? { ...state, article: { ...state.article, coverImage: action.coverImage } }
        : state

    case 'closeArticle':
      return { ...state, article: null }

    case 'setSharedVideo':
      return action.video
        ? withoutBackground({
            ...state,
            sharedVideo: action.video,
            media: [],
            poll: null,
            article: null,
          })
        : { ...state, sharedVideo: null }

    default:
      return state
  }
}

/** Empreinte stable du contenu, pour détecter une saisie non enregistrée. */
export function composeSnapshot(state: ComposeState): string {
  return JSON.stringify({
    text: state.text.trim(),
    media: state.media.map((item) => `${item.type}:${item.uri}`),
    visibility: state.visibility,
    commentsEnabled: state.commentsEnabled,
    background: state.background,
    location: state.location?.name ?? null,
    mood: state.mood?.label ?? null,
    poll: state.poll
      ? {
          question: state.poll.question.trim(),
          options: state.poll.options.map((option) => option.text.trim()),
        }
      : null,
    article: state.article
      ? {
          title: state.article.title.trim(),
          body: state.article.body.trim(),
          cover: state.article.coverImage,
        }
      : null,
    sharedVideo: state.sharedVideo?.sharedVideoId ?? null,
  })
}

export function inferFormat(state: ComposeState): NewsPostFormat {
  if (state.article) return 'article'
  if (state.sharedVideo) return 'video_share'
  if (state.media.length === 0) return 'text'
  if (state.media[0].type === 'video') return 'video'
  return state.media.length > 1 ? 'carousel' : 'image'
}

export function useComposeState(initial: ComposeState = EMPTY_COMPOSE) {
  const [state, dispatch] = useReducer(composeReducer, initial)

  const snapshot = useMemo(() => composeSnapshot(state), [state])
  const format = useMemo(() => inferFormat(state), [state])

  /* Un sondage n'est publiable qu'avec une question et deux options
     remplies — sinon on met en ligne un vote auquel on ne peut pas répondre. */
  const pollValid = state.poll
    ? state.poll.question.trim().length > 0 &&
      state.poll.options.filter((option) => option.text.trim()).length >= POLL_MIN_OPTIONS
    : true

  const articleValid = state.article
    ? state.article.title.trim().length > 0 && state.article.body.trim().length > 0
    : true

  const hasContent =
    state.text.trim().length > 0 ||
    state.media.length > 0 ||
    Boolean(state.poll) ||
    Boolean(state.sharedVideo) ||
    Boolean(state.article)

  const canPublish = hasContent && pollValid && articleValid

  /* Le fond coloré ne s'applique qu'au texte seul. */
  const canUseBackground =
    state.media.length === 0 && !state.poll && !state.article && !state.sharedVideo

  const setText = useCallback((text: string) => dispatch({ type: 'setText', text }), [])

  return {
    state,
    dispatch,
    setText,
    snapshot,
    format,
    canPublish,
    canUseBackground,
    pollValid,
    articleValid,
    hasContent,
  }
}
