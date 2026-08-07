/* src/features/news/services/postMutations.ts

   Écritures Firestore de la collection `posts`. Aucun composant n'écrit
   directement : tout passe par ici, pour que les contraintes des règles de
   sécurité soient exprimées à un seul endroit.

   Contrat imposé par firestore.rules :
   - `format` et `visibility` sont bornés à des énumérations ;
   - `verified` est dénormalisé depuis le doc user à la création, et ne peut
     plus bouger ensuite ;
   - les agrégats (likes, comments, saves, reposts…) appartiennent aux Cloud
     Functions. Ils sont initialisés à zéro à la création puis jamais réécrits
     — un update qui les touche est rejeté par les règles. */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { mapDocToPost } from './newsFeedSource'
import type {
  NewsLocation,
  NewsMood,
  NewsPoll,
  NewsPost,
  NewsPostArticle,
  NewsPostFormat,
  NewsPostMedia,
  NewsPostVideoShare,
  NewsPostVisibility,
  PostBackgroundId,
} from '../types'

/** Contenu éditable d'une publication, commun à la création et à l'édition. */
export interface PostDraft {
  text: string
  format: NewsPostFormat
  media: NewsPostMedia[]
  visibility: NewsPostVisibility
  commentsEnabled: boolean
  background: PostBackgroundId
  location: NewsLocation | null
  mood: NewsMood | null
  poll: NewsPoll | null
  article: NewsPostArticle | null
  videoShare: NewsPostVideoShare | null
  /** Réglage avancé : les mentions/hashtags de la légende ne sont pas cliquables. */
  hideMentionsAndHashtags: boolean
}

export interface PostAuthor {
  uid: string
  userName: string
  userPhotoURL: string | null
  verified: boolean
}

const HASHTAG_PATTERN = /#[\wÀ-ɏ]+/g

export function extractHashtags(text: string): string[] {
  return Array.from(
    new Set((text.match(HASHTAG_PATTERN) ?? []).map((tag) => tag.slice(1).toLowerCase())),
  )
}

/** Champs éditables — le reste du document appartient aux Cloud Functions. */
function editableFields(draft: PostDraft) {
  return {
    text: draft.text.trim(),
    format: draft.format,
    media: draft.media,
    visibility: draft.visibility,
    commentsEnabled: draft.commentsEnabled,
    background: draft.background,
    hashtags: extractHashtags(draft.text),
    location: draft.location,
    mood: draft.mood,
    poll: draft.poll,
    article: draft.article,
    videoShare: draft.videoShare,
    hideMentionsAndHashtags: draft.hideMentionsAndHashtags,
  }
}

/**
 * Lit le profil pour dénormaliser l'identité de l'auteur dans le post.
 * `verified` doit refléter exactement le doc user, sinon la règle rejette.
 */
export async function loadPostAuthor(uid: string, fallbackName: string): Promise<PostAuthor> {
  const snapshot = await getDoc(doc(db, 'users', uid))
  const profile = snapshot.data()

  return {
    uid,
    userName: profile?.nom || profile?.pseudo || fallbackName,
    userPhotoURL: profile?.photoURL ?? null,
    verified: profile?.verified === true,
  }
}

/**
 * Charge un post pour l'édition. Aucun composant ne lit `posts` directement :
 * le mapping Firestore → NewsPost vit dans mapDocToPost, partagé avec le fil.
 * Renvoie null si le document n'existe pas ou en cas d'erreur (capturée ici),
 * jamais de rejet — l'appelant affiche son erreur générique.
 */
export async function loadPost(postId: string): Promise<NewsPost | null> {
  try {
    const snapshot = await getDoc(doc(db, 'posts', postId))
    if (!snapshot.exists()) return null
    return mapDocToPost(snapshot)
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      { context: 'news.loadPost', postId },
    )
    return null
  }
}

export async function createPost(
  author: PostAuthor,
  draft: PostDraft,
): Promise<string | null> {
  try {
    const created = await addDoc(collection(db, 'posts'), {
      userId: author.uid,
      userName: author.userName,
      userPhotoURL: author.userPhotoURL,
      verified: author.verified,
      ...editableFields(draft),

      // Agrégats possédés par les Cloud Functions : initialisés ici, jamais
      // réécrits ensuite (voir en-tête).
      likes: 0,
      likedBy: [],
      comments: 0,
      shares: 0,
      saves: 0,
      savedBy: [],
      reposts: 0,
      repostedBy: [],

      moderationStatus: 'visible',
      createdAt: serverTimestamp(),
    })

    await updateDoc(doc(db, 'users', author.uid), {
      postsCount: increment(1),
    }).catch((error: unknown) => {
      // Le compteur est cosmétique : son échec ne doit pas perdre le post.
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        { context: 'news.createPost.postsCount', uid: author.uid },
      )
    })

    return created.id
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      { context: 'news.createPost', format: draft.format },
    )
    return null
  }
}

export async function updatePost(postId: string, draft: PostDraft): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'posts', postId), {
      ...editableFields(draft),
      updatedAt: serverTimestamp(),
    })

    return true
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      { context: 'news.updatePost', postId },
    )
    return false
  }
}

export async function deletePost(postId: string, userId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'posts', postId))

    await updateDoc(doc(db, 'users', userId), {
      postsCount: increment(-1),
    }).catch((error: unknown) => {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        { context: 'news.deletePost.postsCount', userId },
      )
    })

    return true
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      { context: 'news.deletePost', postId },
    )
    return false
  }
}
