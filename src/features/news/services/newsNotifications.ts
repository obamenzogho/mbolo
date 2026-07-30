import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'

export type NewsNotificationType =
  | 'post_like'
  | 'post_comment'
  | 'post_repost'

export async function notifyPostOwner(params: {
  postOwnerId: string
  postId: string
  type: NewsNotificationType
  text?: string
}): Promise<void> {
  const uid = auth.currentUser?.uid

  if (!uid || !params.postOwnerId || !params.postId) return
  if (uid === params.postOwnerId) return

  try {
    await addDoc(collection(db, 'notifications'), {
      userId: params.postOwnerId,
      fromUserId: uid,
      postId: params.postId,
      type: params.type,
      text: params.text ?? '',
      read: false,
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      {
        context: 'news.notifyPostOwner',
        type: params.type,
        postId: params.postId,
      },
    )
  }
}
