import {
  arrayRemove,
  arrayUnion,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { notifyPostOwner } from './newsNotifications'

export interface RepostResult {
  reposted: boolean
  reposts: number
}

export async function toggleRepost(
  postId: string,
): Promise<RepostResult | null> {
  const user = auth.currentUser

  if (!user || !postId) return null

  const postRef = doc(db, 'posts', postId)
  const repostRef = doc(db, 'reposts', `${postId}_${user.uid}`)

  try {
    const result = await runTransaction(db, async (transaction) => {
      const postSnapshot = await transaction.get(postRef)
      const repostSnapshot = await transaction.get(repostRef)

      if (!postSnapshot.exists()) {
        throw new Error(`Post introuvable: ${postId}`)
      }

      const postData = postSnapshot.data()
      const alreadyReposted = repostSnapshot.exists()
      const currentReposts = Number(postData.reposts ?? 0)
      const postOwnerId = String(postData.userId ?? '')

      if (alreadyReposted) {
        const nextCount = Math.max(0, currentReposts - 1)

        transaction.delete(repostRef)
        transaction.update(postRef, {
          reposts: nextCount,
          repostedBy: arrayRemove(user.uid),
        })

        return {
          reposted: false,
          reposts: nextCount,
          postOwnerId,
        }
      }

      const nextCount = currentReposts + 1

      transaction.set(repostRef, {
        postId,
        userId: user.uid,
        postOwnerId,
        createdAt: serverTimestamp(),
      })

      transaction.update(postRef, {
        reposts: nextCount,
        repostedBy: arrayUnion(user.uid),
      })

      return {
        reposted: true,
        reposts: nextCount,
        postOwnerId,
      }
    })

    if (result.reposted) {
      void notifyPostOwner({
        postOwnerId: result.postOwnerId,
        postId,
        type: 'post_repost',
        text: 'a reposté votre publication',
      })
    }

    return {
      reposted: result.reposted,
      reposts: result.reposts,
    }
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      {
        context: 'news.toggleRepost',
        postId,
      },
    )

    return null
  }
}
