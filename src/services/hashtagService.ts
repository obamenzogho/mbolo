import {
  collection, query, where, orderBy, limit, getDocs, doc, getDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { captureException } from '../lib/sentry'

export interface TrendingHashtag {
  tag: string
  videoCount: number
  trendingScore: number
}

export async function getTrendingHashtags(max = 10): Promise<TrendingHashtag[]> {
  try {
    const q = query(
      collection(db, 'hashtags'),
      where('videoCount', '>', 0),
      orderBy('videoCount'),
      orderBy('trendingScore', 'desc'),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => d.data() as TrendingHashtag)
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getTrendingHashtags' })
    return []
  }
}

export async function getVideosByHashtag(tag: string, max = 30) {
  const normalized = tag.replace(/^#/, '').toLowerCase().trim()
  try {
    const q = query(
      collection(db, 'videos'),
      where('hashtags', 'array-contains', normalized),
      orderBy('createdAt', 'desc'),
      limit(max),
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getVideosByHashtag' })
    return []
  }
}

export async function getHashtagMeta(tag: string): Promise<TrendingHashtag | null> {
  const normalized = tag.replace(/^#/, '').toLowerCase().trim()
  try {
    const snap = await getDoc(doc(db, 'hashtags', normalized))
    return snap.exists() ? (snap.data() as TrendingHashtag) : null
  } catch {
    return null
  }
}
