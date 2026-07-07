import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../../lib/firebase'

const viewedThisSession = new Set<string>()

export async function recordView(videoId: string) {
  const uid = auth.currentUser?.uid
  if (!uid || !videoId) return
  const key = `${uid}:${videoId}`
  if (viewedThisSession.has(key)) return
  viewedThisSession.add(key)

  try {
    await setDoc(
      doc(db, 'videos', videoId, 'views', uid),
      { viewedAt: serverTimestamp() },
      { merge: true },
    )
  } catch {
    viewedThisSession.delete(key)
  }
}
