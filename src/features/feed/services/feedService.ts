import {
  collection, query, orderBy, limit, startAfter, getDocs,
  getDoc, doc, where, QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore'
import { db, auth } from '../../../lib/firebase'
import { withFirestoreRetry } from '../../../lib/firestoreRetry'
import { scoreVideo } from '../../../lib/scoring'
import { getSeenVideos, markSeenAndIncrementView, clearSeenVideos } from '../../../lib/feed'
import type { Video as VideoType, User } from '../../../types'

const FOLLOWING_QUERY_LIMIT = 10
const FETCH_COUNT = 20

let userCache = new Map<string, Pick<User, 'nom' | 'photoURL'>>()

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}

function toVideo(docSnap: QueryDocumentSnapshot<DocumentData>): VideoType | null {
  const data = docSnap.data()
  if (!data.userId || !data.videoURL) return null
  return { id: docSnap.id, ...data } as VideoType
}

function sortByCreatedAtDesc(a: VideoType, b: VideoType) {
  const aVal = (a.createdAt as any)?.seconds ?? (a.createdAt ? new Date(a.createdAt as any).getTime() / 1000 : 0)
  const bVal = (b.createdAt as any)?.seconds ?? (b.createdAt ? new Date(b.createdAt as any).getTime() / 1000 : 0)
  return bVal - aVal
}

export function filterSeen(items: VideoType[], seenIds: string[]): VideoType[] {
  if (seenIds.length === 0) return items
  return items.filter(v => !seenIds.includes(v.id))
}

export async function loadSeenVideos(): Promise<string[]> {
  return getSeenVideos()
}

export async function loadFollowingIds(): Promise<string[]> {
  const user = auth.currentUser
  if (!user) return []
  try {
    const snap = await getDoc(doc(db, 'users', user.uid))
    return snap.exists() ? (snap.data().following || []) : []
  } catch (e) { console.warn('loadFollowingIds error:', e); return [] }
}

export async function loadUserMeta(): Promise<{ seen: string[]; following: string[] }> {
  const user = auth.currentUser
  if (!user) return { seen: [], following: [] }
  try {
    const snap = await getDoc(doc(db, 'users', user.uid))
    if (!snap.exists()) return { seen: [], following: [] }
    const data = snap.data()
    return { seen: data.seenVideos || [], following: data.following || [] }
  } catch (e) { console.warn('loadUserMeta error:', e); return { seen: [], following: [] } }
}

export async function fetchPourtoiVideos(
  lastDoc: QueryDocumentSnapshot<DocumentData> | null,
  batchSize: number,
  seenIds: string[],
): Promise<{
  items: VideoType[]
  nextDoc: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}> {
  const feedQuery = lastDoc
    ? query(collection(db, 'videos'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(FETCH_COUNT))
    : query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(FETCH_COUNT))

  const snapshot = await getDocs(feedQuery)
  let items = snapshot.docs.map(toVideo).filter(Boolean) as VideoType[]

  const ownUserId = auth.currentUser?.uid
  if (ownUserId) {
    items = items.filter(v => v.userId !== ownUserId)
  }

  if (snapshot.empty || items.length === 0) {
    return { items: [], nextDoc: null, hasMore: false }
  }

  const nextDoc = snapshot.docs[snapshot.docs.length - 1]
  const unseen = filterSeen(items, seenIds)
  const scored = unseen.map(v => ({ ...v, _score: scoreVideo(v) }))
    .sort((a, b) => (b as any)._score - (a as any)._score)
    .slice(0, batchSize)

  return { items: scored, nextDoc, hasMore: items.length >= FETCH_COUNT }
}

export async function fetchSuiviVideos(
  followingIds: string[],
  startIdx: number,
  batchSize: number,
  seenIds: string[],
): Promise<{
  items: VideoType[]
  nextIdx: number
  hasMore: boolean
}> {
  if (followingIds.length === 0 || startIdx >= followingIds.length) {
    return { items: [], nextIdx: startIdx, hasMore: false }
  }

  const batchIds = followingIds.slice(startIdx, startIdx + FOLLOWING_QUERY_LIMIT)
  const nextIdx = startIdx + batchIds.length

  const queries = chunk(batchIds, FOLLOWING_QUERY_LIMIT).map(ids =>
    getDocs(query(collection(db, 'videos'), where('userId', 'in', ids), orderBy('createdAt', 'desc'), limit(batchSize)))
  )

  const result = await withFirestoreRetry(
    () => Promise.all(queries),
    { context: 'feed/suivi' },
  )

  if (result.error) {
    console.error('[Firestore] feed/suivi echec apres retry:', result.error.message)
    throw result.error
  }

  const snapshots = result.data!
  const items = snapshots.flatMap(s => s.docs).map(toVideo).filter(Boolean) as VideoType[]
  items.sort(sortByCreatedAtDesc)
  const page = items.slice(0, batchSize)

  const unseen = filterSeen(page, seenIds)
  const hasMore = nextIdx < followingIds.length || items.length >= batchSize

  return { items: unseen, nextIdx, hasMore }
}

export async function batchFetchUsers(userIds: string[]): Promise<Map<string, Pick<User, 'nom' | 'photoURL'>>> {
  const uncached = userIds.filter(id => !userCache.has(id))
  if (uncached.length > 0) {
    const batches = chunk(uncached, 30)
    const results = await Promise.all(
      batches.map(batch =>
        getDocs(query(collection(db, 'users'), where('__name__', 'in', batch)))
      )
    )
    for (const snap of results.flatMap(r => r.docs)) {
      const d = snap.data()
      userCache.set(snap.id, { nom: d.nom || 'utilisateur', photoURL: d.photoURL || '' })
    }
  }
  const result = new Map<string, Pick<User, 'nom' | 'photoURL'>>()
  for (const id of userIds) {
    const cached = userCache.get(id)
    if (cached) result.set(id, cached)
  }
  return result
}

export function clearUserCache(): void {
  userCache.clear()
}

export async function fetchVideoCounts(videoId: string): Promise<{
  liked: boolean
  saved: boolean
  likes: number
  saves: number
  comments: number
  shares: number
  likedBy: string[]
  savedBy: string[]
}> {
  const user = auth.currentUser
  const snap = await getDoc(doc(db, 'videos', videoId))
  if (!snap.exists()) {
    return { liked: false, saved: false, likes: 0, saves: 0, comments: 0, shares: 0, likedBy: [], savedBy: [] }
  }
  const d = snap.data()
  return {
    liked: user ? (d.likedBy?.includes(user.uid) ?? false) : false,
    saved: user ? (d.savedBy?.includes(user.uid) ?? false) : false,
    likes: typeof d.likes === 'number' ? d.likes : 0,
    saves: typeof d.saves === 'number' ? d.saves : 0,
    comments: typeof d.comments === 'number' ? d.comments : 0,
    shares: typeof d.shares === 'number' ? d.shares : 0,
    likedBy: d.likedBy || [],
    savedBy: d.savedBy || [],
  }
}

export { markSeenAndIncrementView, clearSeenVideos }
