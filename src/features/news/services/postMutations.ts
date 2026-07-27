import {
  doc,
  deleteDoc,
  updateDoc,
  increment,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'

export async function deletePost(postId: string, userId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'posts', postId))

    await updateDoc(doc(db, 'users', userId), {
      postsCount: increment(-1),
    }).catch(() => {})

    return true
  } catch (error) {
    captureException(
      error instanceof Error ? error : new Error(String(error)),
      { context: 'news.deletePost', postId },
    )
    return false
  }
}
