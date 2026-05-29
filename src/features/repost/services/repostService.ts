import {
  collection, doc, addDoc, deleteDoc, getDocs, query, where, orderBy, limit, startAfter,
  updateDoc, increment, arrayUnion, arrayRemove, serverTimestamp, getDoc, deleteField,
  type QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { withFirestoreRetry } from '@/lib/firestoreRetry'
import { createNotification } from '@/lib/notifications'
import type { Video, Repost } from '@/types'

const REPOSTS_COLLECTION = 'reposts'
const PAGE_SIZE = 30

export async function toggleRepost(
  videoId: string,
  userId: string,
  videoOwnerId: string,
): Promise<{ reposted: boolean; repostCount: number }> {
  const repostRef = collection(db, REPOSTS_COLLECTION)
  const q = query(
    repostRef,
    where('userId', '==', userId),
    where('postId', '==', videoId),
    limit(1),
  )
  const snap = await getDocs(q)

  if (!snap.empty) {
    await deleteDoc(doc(db, REPOSTS_COLLECTION, snap.docs[0].id))
    const videoRef = doc(db, 'videos', videoId)
    const videoSnap = await getDoc(videoRef)
    const currentRepostedBy = videoSnap.data()?.repostedBy ?? []
    const remaining = currentRepostedBy.filter((id: string) => id !== userId)
    const updateData: Record<string, any> = {
      reposts: increment(-1),
      repostedBy: arrayRemove(userId),
    }
    if (remaining.length > 0) {
      const lastReposter = remaining[remaining.length - 1]
      const lastReposterSnap = await getDoc(doc(db, 'users', lastReposter))
      if (lastReposterSnap.exists()) {
        updateData.latestRepostedBy = {
          userId: lastReposter,
          userName: lastReposterSnap.data().pseudo || lastReposterSnap.data().nom,
        }
      }
    } else {
      updateData.latestRepostedBy = deleteField()
    }
    await updateDoc(videoRef, updateData)
    return { reposted: false, repostCount: 0 }
  }

  const userSnap = await getDoc(doc(db, 'users', userId))
  const userName = userSnap.exists()
    ? (userSnap.data().pseudo || userSnap.data().nom)
    : userId

  await addDoc(repostRef, {
    userId,
    postId: videoId,
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'videos', videoId), {
    reposts: increment(1),
    repostedBy: arrayUnion(userId),
    latestRepostedBy: { userId, userName },
  })
  createNotification({
    userId: videoOwnerId,
    type: 'repost',
    fromUserId: userId,
    videoId,
  })
  return { reposted: true, repostCount: 0 }
}

export async function getRepostedVideos(
  userId: string,
  lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<{ videos: Video[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
  const q = lastDoc
    ? query(
        collection(db, REPOSTS_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE),
      )
    : query(
        collection(db, REPOSTS_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      )

  const result = await withFirestoreRetry(() => getDocs(q), { context: 'getRepostedVideos' })
  if (result.error) {
    captureException(result.error, { context: 'getRepostedVideos' })
    return { videos: [], lastDoc: null, hasMore: false }
  }

  const snap = result.data as any
  if (!snap || snap.empty) return { videos: [], lastDoc: null, hasMore: false }

  const reposts: Repost[] = snap.docs.map((d: any) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
  }))

  const videoIds = reposts.map((r) => r.postId)
  const videoChunks: string[][] = []
  for (let i = 0; i < videoIds.length; i += 30) {
    videoChunks.push(videoIds.slice(i, i + 30))
  }

  const videoMap = new Map<string, Video>()
  for (const chunk of videoChunks) {
    const videoQuery = query(
      collection(db, 'videos'),
      where('__name__', 'in', chunk),
      limit(30),
    )
    const videoResult = await withFirestoreRetry(() => getDocs(videoQuery), {
      context: 'getRepostedVideos/fetchVideos',
    })
    if (!videoResult.error) {
      const videoSnap = videoResult.data as any
      videoSnap.docs.forEach((d: any) => {
        videoMap.set(d.id, { id: d.id, ...d.data() } as Video)
      })
    }
  }

  const videos = reposts
    .map((r) => videoMap.get(r.postId))
    .filter((v): v is Video => v != null && !v.corrupted)

  const last = snap.docs[snap.docs.length - 1] || null
  return {
    videos,
    lastDoc: last,
    hasMore: snap.docs.length === PAGE_SIZE,
  }
}

export async function checkRepostStatus(
  videoId: string,
  userId: string,
): Promise<boolean> {
  const q = query(
    collection(db, REPOSTS_COLLECTION),
    where('userId', '==', userId),
    where('postId', '==', videoId),
    limit(1),
  )
  const snap = await getDocs(q)
  return !snap.empty
}
