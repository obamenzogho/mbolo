/* src/features/news/services/postInteractions.ts

   Toutes les écritures Firestore liées à une carte de post, sorties de l'UI.

   Le j'aime est écrit directement sur le document post (likes/likedBy) par
   transaction, comme dans le feed vidéo. La sauvegarde et le repost passent
   par une sous-collection `posts/{postId}/<kind>/{userId}` ; les règles
   Firestore autorisent le membre à basculer son propre état, jamais les
   champs d'agrégation. */

import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'

const POSTS = 'posts'

function report(error: unknown, context: string, postId: string): void {
  captureException(
    error instanceof Error ? error : new Error(String(error)),
    { context, postId },
  )
}

export interface ToggleResult {
  active: boolean
  delta: number
}

/** J'aime : écriture transactionnelle directe sur le document post. */
export async function togglePostLike(
  postId: string,
  userId: string,
): Promise<ToggleResult | null> {
  if (!userId) return null

  try {
    const postRef = doc(db, POSTS, postId)

    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(postRef)

      if (!snap.exists()) return null

      const data = snap.data()
      const likedBy: string[] = Array.isArray(data.likedBy)
        ? data.likedBy
        : []
      const liked = likedBy.includes(userId)

      transaction.update(postRef, {
        likedBy: liked ? arrayRemove(userId) : arrayUnion(userId),
        likes: increment(liked ? -1 : 1),
      })

      return { active: !liked, delta: liked ? -1 : 1 }
    })
  } catch (error) {
    report(error, 'postInteractions.togglePostLike', postId)
    return null
  }
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
