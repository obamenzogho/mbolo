import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore'
import { db, auth } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import type { UserTaste } from './rankVideos'
import { EMPTY_TASTE } from './rankVideos'
import { loadWatchCache } from './watchTracker'

export async function buildUserTaste(): Promise<UserTaste> {
  const uid = auth.currentUser?.uid
  if (!uid) return EMPTY_TASTE

  try {
    const snap = await getDocs(
      query(collection(db, 'users', uid, 'likedVideos'), orderBy('createdAt', 'desc'), limit(100))
    )

    const likedHashtags: Record<string, number> = {}
    const likedCreators: Record<string, number> = {}

    await Promise.all(snap.docs.map(async (d) => {
      const data = d.data()
      let hashtags: string[] = data.hashtags ?? []
      let creatorId: string | undefined = data.creatorId

      if (!hashtags.length && !creatorId) {
        const vSnap = await getDoc(doc(db, 'videos', d.id))
        if (!vSnap.exists()) return
        const vd = vSnap.data()
        hashtags = vd.hashtags ?? []
        creatorId = vd.userId
      }

      for (const tag of hashtags) likedHashtags[tag] = (likedHashtags[tag] ?? 0) + 1
      if (creatorId) likedCreators[creatorId] = (likedCreators[creatorId] ?? 0) + 1
    }))

    const watchedRatio = await loadWatchCache()

    return { likedHashtags, likedCreators, watchedRatio }
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'buildUserTaste' })
    return EMPTY_TASTE
  }
}
