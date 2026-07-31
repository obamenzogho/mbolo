/* src/features/news/services/postInteractions.ts

   Toutes les écritures Firestore liées à une carte de post, sorties de l'UI.
   Une transaction par intention, aucune boucle de lecture, delta renvoyé au
   hook pour que l'optimiste et le serveur convergent.

   À valider lors de la passe backend :
   - règles `posts` : autoriser l'update partiel de reactionCounts / savedBy
     / repostedBy sans autoriser l'écriture libre du document.
   - sous-collection `posts/{postId}/reactions/{userId}` : lecture publique,
     écriture réservée à l'auteur de la réaction. */

import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  increment,
  runTransaction,
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
 * `next === null` retire la réaction courante.
 */
export async function setPostReaction(
  postId: string,
  userId: string,
  next: PostReactionType | null,
): Promise<ReactionResult | null> {
  if (!userId) return null

  const postRef = doc(db, POSTS, postId)
  const reactionRef = doc(db, POSTS, postId, 'reactions', userId)

  try {
    return await runTransaction(db, async (transaction) => {
      const [postSnap, reactionSnap] = await Promise.all([
        transaction.get(postRef),
        transaction.get(reactionRef),
      ])

      if (!postSnap.exists()) {
        throw new Error('Publication introuvable')
      }

      const previous =
        (reactionSnap.data()?.type as PostReactionType | undefined) ?? null

      if (previous === next) {
        return { reaction: previous, previous, totalDelta: 0 }
      }

      const totalDelta = (next ? 1 : 0) - (previous ? 1 : 0)
      const updates: Record<string, unknown> = {
        'reactionCounts.total': increment(totalDelta),
        // Compatibilité avec l'ancien modèle likes / likedBy
        likes: increment(totalDelta),
        likedBy: next ? arrayUnion(userId) : arrayRemove(userId),
      }

      if (previous) updates[`reactionCounts.${previous}`] = increment(-1)
      if (next) updates[`reactionCounts.${next}`] = increment(1)

      transaction.update(postRef, updates)

      if (next) {
        transaction.set(reactionRef, {
          type: next,
          userId,
          createdAt: serverTimestamp(),
        })
      } else {
        transaction.delete(reactionRef)
      }

      return { reaction: next, previous, totalDelta }
    })
  } catch (error) {
    report(error, 'postInteractions.setPostReaction', postId)
    return null
  }
}

export interface ToggleResult {
  active: boolean
  delta: number
}

export async function togglePostSave(
  postId: string,
  userId: string,
): Promise<ToggleResult | null> {
  if (!userId) return null

  const postRef = doc(db, POSTS, postId)

  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(postRef)

      if (!snap.exists()) {
        throw new Error('Publication introuvable')
      }

      const savedBy: string[] = snap.data().savedBy ?? []
      const wasSaved = savedBy.includes(userId)

      transaction.update(postRef, {
        savedBy: wasSaved ? arrayRemove(userId) : arrayUnion(userId),
        saves: increment(wasSaved ? -1 : 1),
      })

      return { active: !wasSaved, delta: wasSaved ? -1 : 1 }
    })
  } catch (error) {
    report(error, 'postInteractions.togglePostSave', postId)
    return null
  }
}

export async function togglePostRepost(
  postId: string,
  userId: string,
): Promise<ToggleResult | null> {
  if (!userId) return null

  const postRef = doc(db, POSTS, postId)
  const repostRef = doc(db, 'users', userId, 'reposts', postId)

  try {
    const result = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(postRef)

      if (!snap.exists()) {
        throw new Error('Publication introuvable')
      }

      const repostedBy: string[] = snap.data().repostedBy ?? []
      const wasReposted = repostedBy.includes(userId)

      transaction.update(postRef, {
        repostedBy: wasReposted ? arrayRemove(userId) : arrayUnion(userId),
        reposts: increment(wasReposted ? -1 : 1),
      })

      return { active: !wasReposted, delta: wasReposted ? -1 : 1 }
    })

    // Index côté utilisateur, hors transaction : non critique pour le compteur.
    if (result.active) {
      await setDoc(repostRef, { postId, createdAt: serverTimestamp() })
    } else {
      await deleteDoc(repostRef)
    }

    return result
  } catch (error) {
    report(error, 'postInteractions.togglePostRepost', postId)
    return null
  }
}

export async function incrementShareCount(postId: string): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const postRef = doc(db, POSTS, postId)
      const snap = await transaction.get(postRef)

      if (!snap.exists()) return

      transaction.update(postRef, { shares: increment(1) })
    })
  } catch (error) {
    report(error, 'postInteractions.incrementShareCount', postId)
  }
}
