import { doc, getDoc, updateDoc, runTransaction, increment, arrayUnion } from 'firebase/firestore'
import { db, auth } from './firebase'
import { captureException } from './sentry'

export async function getSeenVideos(): Promise<string[]> {
  const user = auth.currentUser
  if (!user) return []
  try {
    const snap = await getDoc(doc(db, 'users', user.uid))
    if (snap.exists()) return snap.data().seenVideos || []
    return []
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getSeenVideos' })
    console.warn('getSeenVideos error:', e)
    return []
  }
}

export async function markSeenAndIncrementView(videoId: string): Promise<void> {
  const user = auth.currentUser
  if (!user) return
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', user.uid)
      const userSnap = await transaction.get(userRef)
      if (!userSnap.exists()) return
      const seen = userSnap.data().seenVideos || []
      if (seen.includes(videoId)) return
      transaction.update(userRef, { seenVideos: arrayUnion(videoId) })
      transaction.update(doc(db, 'videos', videoId), { views: increment(1) })
    })
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'markSeenAndIncrementView' })
    console.warn('markSeenAndIncrementView error:', e)
  }
}

export async function clearSeenVideos(): Promise<void> {
  const user = auth.currentUser
  if (!user) return
  try {
    await updateDoc(doc(db, 'users', user.uid), { seenVideos: [] })
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'clearSeenVideos' })
    console.warn('clearSeenVideos error:', e)
  }
}
