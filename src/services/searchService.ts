import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import { getBlockedUserIds } from '../lib/blockService'
import { getTrendingHashtags, getVideosByHashtag, type TrendingHashtag } from './hashtagService'

export interface UserResult {
  id: string
  pseudo: string
  nom?: string
  photoURL?: string
  verified?: boolean
}

export interface SearchResults {
  users: UserResult[]
  hashtags: TrendingHashtag[]
  videos: any[]
}

export async function searchUsers(term: string, max = 15): Promise<UserResult[]> {
  const q = term.trim().toLowerCase()
  if (!q) return []
  try {
    const snap = await getDocs(query(
      collection(db, 'users'),
      where('pseudoLower', '>=', q),
      where('pseudoLower', '<=', q + '\uf8ff'),
      limit(max),
    ))
    const blocked = await getBlockedUserIds()
    const me = auth.currentUser?.uid
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((u) => u.id !== me && !blocked.has(u.id))
      .map((u) => ({ id: u.id, pseudo: u.pseudo, nom: u.nom, photoURL: u.photoURL, verified: u.verified }))
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'searchUsers' })
    return []
  }
}

export async function searchAll(term: string): Promise<SearchResults> {
  const t = term.trim()
  if (!t) return { users: [], hashtags: [], videos: [] }

  if (t.startsWith('#')) {
    const videos = await getVideosByHashtag(t)
    return { users: [], hashtags: [], videos }
  }

  const [users, allTags] = await Promise.all([
    searchUsers(t),
    getTrendingHashtags(50),
  ])
  const q = t.toLowerCase()
  const hashtags = allTags.filter((h) => h.tag.includes(q)).slice(0, 8)
  return { users, hashtags, videos: [] }
}
