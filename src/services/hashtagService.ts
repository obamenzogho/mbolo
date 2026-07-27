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
    return snap.docs.map((d: any) => d.data() as TrendingHashtag)
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getTrendingHashtags' })
    return []
  }
}

export async function getTrendingHashtagsByCity(city: string, max = 10): Promise<TrendingHashtag[]> {
  try {
    const q = query(
      collection(db, 'videos'),
      where('place', '==', city),
      orderBy('createdAt', 'desc'),
      limit(100),
    )
    const snap = await getDocs(q)

    const counts: Record<string, number> = {}
    snap.forEach((d) => {
      const tags: string[] = d.data().hashtags ?? []
      for (const t of tags) {
        const tag = t.toLowerCase().trim()
        counts[tag] = (counts[tag] ?? 0) + 1
      }
    })

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([tag, videoCount]) => ({ tag, videoCount, trendingScore: videoCount }))
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getTrendingHashtagsByCity' })
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
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
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
