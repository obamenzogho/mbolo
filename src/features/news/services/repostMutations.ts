import {
  arrayRemove,
  arrayUnion,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'

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
    return await runTransaction(db, async (transaction) => {
      const [postSnapshot, repostSnapshot] = await Promise.all([
        transaction.get(postRef),
        transaction.get(repostRef),
      ])

      if (!postSnapshot.exists()) {
        throw new Error(`Post introuvable: ${postId}`)
      }

      const postData = postSnapshot.data()
      const alreadyReposted = repostSnapshot.exists()
      const currentReposts = Number(postData.reposts ?? 0)

      if (alreadyReposted) {
        transaction.delete(repostRef)
        transaction.update(postRef, {
          reposts: Math.max(0, currentReposts - 1),
          repostedBy: arrayRemove(user.uid),
        })

        return {
          reposted: false,
          reposts: Math.max(0, currentReposts - 1),
        }
      }

      transaction.set(repostRef, {
        postId,
        userId: user.uid,
        postOwnerId: postData.userId ?? '',
        createdAt: serverTimestamp(),
      })

      transaction.update(postRef, {
        reposts: currentReposts + 1,
        repostedBy: arrayUnion(user.uid),
      })

      return {
        reposted: true,
        reposts: currentReposts + 1,
      }
    })
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
