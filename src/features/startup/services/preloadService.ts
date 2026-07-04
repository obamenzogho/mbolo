import { db, auth } from '@/lib/firebase'
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore'
import { captureException } from '@/lib/sentry'
import { cacheFeed } from './cacheHydrationService'
import type { Video } from '@/types'

export async function preloadFeed(): Promise<Video[]> {
  try {
    const q = query(
      collection(db, 'videos'),
      where('corrupted', '!=', true),
      orderBy('createdAt', 'desc'),
      limit(20),
    )
    const snapshot = await getDocs(q)
    const videos = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() ?? new Date(),
    })) as Video[]

    await cacheFeed(videos)
    return videos
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), { context: 'preloadFeed' })
    return []
  }
}

export async function preloadNotifications(): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) return

  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(10),
    )
    await getDocs(q)
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), { context: 'preloadNotifications' })
  }
}

export async function warmFirestoreConnections(): Promise<void> {
  try {
    await getDocs(query(collection(db, 'videos'), limit(1)))
  } catch {
    /* Silently ignore, connection may already be warm */
  }
}
