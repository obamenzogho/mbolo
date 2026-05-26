import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { captureException } from './sentry'

type NotificationType = 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accept' | 'reply'

export async function createNotification({
  userId,
  type,
  fromUserId,
  videoId,
}: {
  userId: string
  type: NotificationType
  fromUserId: string
  videoId?: string
}): Promise<void> {
  if (!userId || !fromUserId || userId === fromUserId) return
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type,
      fromUserId,
      videoId: videoId || null,
      read: false,
      createdAt: serverTimestamp(),
    })
  } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'createNotification' }); console.warn('createNotification error:', e) }
}
