import { auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import { getTrendingHashtags, getVideosByHashtag, type TrendingHashtag } from './hashtagService'
import { searchUsers as typesenseSearchUsers, type UserResult } from './typesense-search'

export type { UserResult }

export interface SearchResults {
  users: UserResult[]
  hashtags: TrendingHashtag[]
  videos: any[]
}

export async function searchUsers(term: string, max = 15): Promise<UserResult[]> {
  try {
    return await typesenseSearchUsers(term, max)
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
