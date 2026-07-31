/* src/features/news/services/postInteractions.ts

   Toutes les écritures Firestore liées à une carte de post, sorties de l'UI.

   Le mobile n'écrit JAMAIS les compteurs du document post (likes,
   reactionCounts, savedBy, reposts, shares...) : il exprime son intention
   dans une sous-collection `posts/{postId}/<kind>/{userId}`. Les Cloud
   Functions agrègent ensuite les compteurs sur le document (modèle identique
   à celui des vidéos). Les règles Firestore interdisent toute autre écriture. */

import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import type { PostReactionType } from '../types'

const POSTS = 'posts'

function report(error: unknown, context: string, postId: string): void {
  captureException(
    error instanceof Error ? error : new Error(String(error)),
    { context, postId },
  )
}

export interface ReactionResult {
  reaction: PostReactionType | null
  previous: PostReactionType | null
  totalDelta: number
}

/**
 * Pose, remplace ou retire la réaction de l'utilisateur.
 * `next === null` retire la réaction courante. Le compteur du post
 * (`reactionCounts`, `likes`, `likedBy`) est recalculé par la Cloud Function
 * `posts/onReactionWrite`.
 */
export async function setPostReaction(
  postId: string,
  userId: string,
  next: PostReactionType | null,
): Promise<ReactionResult | null> {
  if (!userId) return null

  const reactionRef = doc(db, POSTS, postId, 'reactions', userId)

  try {
    if (next === null) {
      await deleteDoc(reactionRef)

      return {
        reaction: null,
        previous: null,
        totalDelta: -1,
      }
    }

    await setDoc(
      reactionRef,
      {
        userId,
        type: next,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    return {
      reaction: next,
      previous: null,
      totalDelta: 1,
    }
  } catch (error) {
    report(error, 'postInteractions.setPostReaction', postId)
    return null
  }
}

export interface ToggleResult {
  active: boolean
  delta: number
}

/** Sauvegarde : un document `posts/{postId}/saves/{userId}` fait foi. */
export async function togglePostSave(
  postId: string,
  userId: string,
): Promise<ToggleResult | null> {
  if (!userId) return null

  const saveRef = doc(db, POSTS, postId, 'saves', userId)

  try {
    const wasSaved = (await getDoc(saveRef)).exists()

    if (wasSaved) {
      await deleteDoc(saveRef)
    } else {
      await setDoc(saveRef, { userId, createdAt: serverTimestamp() })
    }

    return { active: !wasSaved, delta: wasSaved ? -1 : 1 }
  } catch (error) {
    report(error, 'postInteractions.togglePostSave', postId)
    return null
  }
}

/** Repost : sous-collection du post (agrégat) + historique côté utilisateur. */
export async function togglePostRepost(
  postId: string,
  userId: string,
): Promise<ToggleResult | null> {
  if (!userId) return null

  const postRepostRef = doc(db, POSTS, postId, 'reposts', userId)
  const userRepostRef = doc(db, 'users', userId, 'reposts', postId)

  try {
    const wasReposted = (await getDoc(postRepostRef)).exists()

    if (wasReposted) {
      await deleteDoc(postRepostRef)
      await deleteDoc(userRepostRef)
    } else {
      await setDoc(postRepostRef, { userId, createdAt: serverTimestamp() })
      await setDoc(userRepostRef, {
        userId,
        postId,
        createdAt: serverTimestamp(),
      })
    }

    return { active: !wasReposted, delta: wasReposted ? -1 : 1 }
  } catch (error) {
    report(error, 'postInteractions.togglePostRepost', postId)
    return null
  }
}

/** Partage : un document `posts/{postId}/shares/{userId}` (idempotent). */
export async function recordShare(
  postId: string,
  userId: string,
): Promise<boolean> {
  if (!userId) return false

  try {
    await setDoc(
      doc(db, POSTS, postId, 'shares', userId),
      { userId, createdAt: serverTimestamp() },
    )

    return true
  } catch (error) {
    report(error, 'postInteractions.recordShare', postId)
    return false
  }
}
