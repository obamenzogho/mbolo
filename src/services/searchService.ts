import Typesense from 'typesense'
import { auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import { getBlockedUserIds } from '../lib/blockService'
import { SEARCH_FILTER_BY } from '../lib/typesense-schemas'
import { withTypesenseRetry } from '../lib/typesenseRetry'
import { getCached, setCache } from '../lib/searchCache'
import { getVideosByHashtag, type TrendingHashtag } from './hashtagService'

export type PostMediaType = 'text' | 'image' | 'carousel' | 'article' | 'video' | 'video_share'

export interface UserResult {
  id: string
  pseudo: string
  nom?: string
  bio?: string
  city?: string
  interests?: string[]
  photoURL?: string
  verified?: boolean
  followerCount?: number
}

export interface HashtagResult {
  tag: string
  videoCount: number
  trendingScore: number
}

export interface PostResult {
  id: string
  description?: string
  text?: string
  thumbnailUrl?: string
  mediaUrl?: string
  userName?: string
  userPhoto?: string
  likeCount?: number
  commentCount?: number
  viewCount?: number
  mediaType?: PostMediaType
  createdAt?: number
}

export interface SearchResults {
  users: UserResult[]
  hashtags: HashtagResult[]
  posts: PostResult[]
}

export interface MultiSearchResult {
  users: { hits: any[]; found: number; request_params: any }
  hashtags: { hits: any[]; found: number; request_params: any }
  posts: { hits: any[]; found: number; request_params: any }
}

export interface MergedResult {
  id: string
  type: 'user' | 'hashtag' | 'post'
  normalizedScore: number
  user?: UserResult
  hashtag?: HashtagResult
  post?: PostResult
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
      query_by: 'pseudo,nom,bio,city',
      query_by_weights: '3,2,1,1',
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

export async function searchHashtags(term: string, max = 8): Promise<HashtagResult[]> {
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
    return (res.hits ?? []).map((h: any) => h.document as HashtagResult)
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'searchHashtags' })
    return []
  }
}

export function mapPostHit(h: any): PostResult {
  const d = h.document
  const mediaType = (d.mediaType ?? 'text') as PostMediaType
  return {
    id: d.id,
    description: d.text,
    text: d.text,
    userName: d.userName,
    userPhoto: d.userPhoto,
    likeCount: d.likeCount ?? 0,
    commentCount: d.commentCount ?? 0,
    viewCount: d.viewCount ?? 0,
    mediaType,
    mediaUrl: d.mediaUrl,
    thumbnailUrl: d.thumbnailUrl ?? d.mediaUrl,
    createdAt: d.createdAt,
  }
}

export async function searchPosts(term: string, max = 8): Promise<PostResult[]> {
  const q = term.trim().replace(/^#/, '')
  if (!q) return []
  try {
    const res = await searchClient.collections('posts').documents().search({
      q,
      query_by: 'text,userName',
      query_by_weights: '2,1',
      sort_by: '_text_match:desc,recencyScore:desc',
      num_typos: 2,
      per_page: max,
      filter_by: SEARCH_FILTER_BY,
    })
    return (res.hits ?? []).map(mapPostHit)
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'searchPosts' })
    return []
  }
}

export async function searchVideos(term: string, max = 8): Promise<PostResult[]> {
  return searchPostsByType(term, ['video', 'video_share'], max)
}

export async function searchPostsByType(
  term: string,
  types: PostMediaType[],
  max = 8,
): Promise<PostResult[]> {
  const q = term.trim().replace(/^#/, '')
  if (!q) return []
  try {
    const typeFilter = types.map((t) => `mediaType:=${t}`).join(' || ')
    const res = await searchClient.collections('posts').documents().search({
      q,
      query_by: 'text,userName',
      query_by_weights: '2,1',
      sort_by: '_text_match:desc,recencyScore:desc',
      num_typos: 2,
      per_page: max,
      filter_by: `${SEARCH_FILTER_BY} && (${typeFilter})`,
    })
    return (res.hits ?? []).map(mapPostHit)
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'searchPostsByType' })
    return []
  }
}

export async function searchAll(term: string): Promise<SearchResults> {
  const t = term.trim()
  if (!t) return { users: [], hashtags: [], posts: [] }

  if (t.startsWith('#')) {
    const posts = await getVideosByHashtag(t)
    return { users: [], hashtags: [], posts }
  }

  const [users, hashtags, posts] = await Promise.all([
    searchUsers(t),
    searchHashtags(t),
    searchPosts(t),
  ])
  return { users, hashtags, posts }
}

export async function searchMulti(term: string): Promise<MultiSearchResult> {
  const q = term.trim().replace(/^#/, '')
  if (!q) {
    return {
      users: { hits: [], found: 0, request_params: {} },
      hashtags: { hits: [], found: 0, request_params: {} },
      posts: { hits: [], found: 0, request_params: {} },
    }
  }

  const cached = getCached<MultiSearchResult>(`searchMulti:${q}`)
  if (cached) return cached

  const [usersRes, hashtagsRes, postsRes] = await Promise.all([
    withTypesenseRetry(
      () =>
        searchClient.collections('users').documents().search({
          q,
          query_by: 'pseudo,nom,bio,city',
          query_by_weights: '3,2,1,1',
          sort_by: '_text_match:desc,followerCount:desc',
          num_typos: 2,
          per_page: 8,
        }),
      { context: 'searchMulti.users' },
    ).then((r) => r.data ?? { hits: [], found: 0, request_params: {} as any }),
    withTypesenseRetry(
      () =>
        searchClient.collections('hashtags').documents().search({
          q,
          query_by: 'tag',
          query_by_weights: '3,1',
          sort_by: '_text_match:desc,trendingScore:desc,videoCount:desc',
          num_typos: 1,
          per_page: 8,
        }),
      { context: 'searchMulti.hashtags' },
    ).then((r) => r.data ?? { hits: [], found: 0, request_params: {} as any }),
    withTypesenseRetry(
      () =>
        searchClient.collections('posts').documents().search({
          q,
          query_by: 'text,userName',
          query_by_weights: '2,1',
          sort_by: '_text_match:desc,recencyScore:desc',
          num_typos: 2,
          per_page: 12,
          filter_by: SEARCH_FILTER_BY,
        }),
      { context: 'searchMulti.posts' },
    ).then((r) => r.data ?? { hits: [], found: 0, request_params: {} as any }),
  ])

  const result: MultiSearchResult = {
    users: usersRes as any,
    hashtags: hashtagsRes as any,
    posts: postsRes as any,
  }
  setCache(`searchMulti:${q}`, result)
  return result
}

export function normalizeAndMerge(multi: MultiSearchResult): MergedResult[] {
  const merged: MergedResult[] = []

  const maxUserScore = Math.max(...(multi.users.hits.map((h: any) => h.text_match) || [1]), 1)
  for (const hit of multi.users.hits) {
    const doc = hit.document
    merged.push({
      id: doc.id,
      type: 'user',
      normalizedScore: (hit.text_match ?? 0) / maxUserScore,
      user: doc as UserResult,
    })
  }

  const maxHashScore = Math.max(...(multi.hashtags.hits.map((h: any) => h.text_match) || [1]), 1)
  for (const hit of multi.hashtags.hits) {
    const doc = hit.document
    merged.push({
      id: doc.tag ?? doc.id,
      type: 'hashtag',
      normalizedScore: (hit.text_match ?? 0) / maxHashScore,
      hashtag: doc as HashtagResult,
    })
  }

  const maxPostScore = Math.max(...(multi.posts.hits.map((h: any) => h.text_match) || [1]), 1)
  for (const hit of multi.posts.hits) {
    const doc = hit.document
    merged.push({
      id: doc.id,
      type: 'post',
      normalizedScore: (hit.text_match ?? 0) / maxPostScore,
      post: mapPostHit(hit),
    })
  }

  return merged.sort((a, b) => b.normalizedScore - a.normalizedScore)
}

export function filterPostsByType(posts: PostResult[], types: PostMediaType[]): PostResult[] {
  return posts.filter((p) => p.mediaType && types.includes(p.mediaType))
}
