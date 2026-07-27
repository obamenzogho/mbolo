import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'

type NewsNotificationType = 'post_like' | 'post_comment'

export async function notifyPostOwner(params: {
  postOwnerId: string
  postId: string
  type: NewsNotificationType
  text?: string
}) {
  const uid = auth.currentUser?.uid
  if (!uid || uid === params.postOwnerId) return

  try {
    await addDoc(collection(db, 'notifications'), {
      userId: params.postOwnerId,
      type: params.type,
      fromUserId: uid,
      postId: params.postId,
      text: params.text ?? '',
      read: false,
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      { context: 'newsNotifications.notifyPostOwner', postId: params.postId },
    )
  }
}
