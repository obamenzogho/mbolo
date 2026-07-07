import Typesense from 'typesense'
import { auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import { getBlockedUserIds } from '../lib/blockService'
import { getVideosByHashtag, type TrendingHashtag } from './hashtagService'

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

const searchClient = new Typesense.Client({
  nodes: [{ host: process.env.EXPO_PUBLIC_TYPESENSE_HOST!, port: 443, protocol: 'https' }],
  apiKey: process.env.EXPO_PUBLIC_TYPESENSE_SEARCH_KEY!,
  connectionTimeoutSeconds: 4,
})

export async function searchUsers(term: string, max = 15): Promise<UserResult[]> {
  const q = term.trim()
  if (!q) return []
  try {
    const res = await searchClient.collections('users').documents().search({
      q,
      query_by: 'pseudo,nom',
      query_by_weights: '2,1',
      sort_by: '_text_match:desc,followerCount:desc',
      num_typos: 2,
      per_page: max,
    })
    const me = auth.currentUser?.uid
    const blocked = await getBlockedUserIds()
    return (res.hits ?? [])
      .map((h: any) => h.document as UserResult)
      .filter((u) => u.id !== me && !blocked.has(u.id))
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'searchUsers' })
    return []
  }
}

export async function searchHashtags(term: string, max = 8): Promise<TrendingHashtag[]> {
  const q = term.trim().replace(/^#/, '')
  if (!q) return []
  try {
    const res = await searchClient.collections('hashtags').documents().search({
      q,
      query_by: 'tag',
      sort_by: '_text_match:desc,videoCount:desc',
      num_typos: 1,
      per_page: max,
    })
    return (res.hits ?? []).map((h: any) => h.document as TrendingHashtag)
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'searchHashtags' })
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

  const [users, hashtags] = await Promise.all([
    searchUsers(t),
    searchHashtags(t),
  ])
  return { users, hashtags, videos: [] }
}
