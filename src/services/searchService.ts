import Typesense from 'typesense'
import { auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import { getBlockedUserIds } from '../lib/blockService'
import { SEARCH_FILTER_BY } from '../lib/typesense-schemas'
import { withTypesenseRetry } from '../lib/typesenseRetry'
import { getCached, setCache } from '../lib/searchCache'

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
  shareCount?: number
  saveCount?: number
  viewCount?: number
  mediaType?: PostMediaType
  createdAt?: number
}

export interface VideoResult {
  id: string
  text?: string
  description?: string
  userName?: string
  userId?: string
  userPhoto?: string
  hashtags?: string[]
  soundId?: string
  videoURL?: string
  thumbnailURL?: string
  type?: string
  mediaType?: PostMediaType
  likeCount?: number
  commentCount?: number
  shareCount?: number
  saveCount?: number
  viewCount?: number
  createdAt?: number
}

export interface SearchResults {
  users: UserResult[]
  hashtags: HashtagResult[]
  posts: PostResult[]
  videos: VideoResult[]
}

export interface MultiSearchResult {
  users: { hits: any[]; found: number; request_params: any }
  hashtags: { hits: any[]; found: number; request_params: any }
  posts: { hits: any[]; found: number; request_params: any }
  videos: { hits: any[]; found: number; request_params: any }
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

export function mapVideoHit(hit: any): VideoResult {
  const data = hit.document ?? hit

  return {
    id: String(data.id ?? ''),
    text: String(data.text ?? data.description ?? ''),
    description: String(
      data.description ?? data.text ?? '',
    ),
    userName: String(data.userName ?? ''),
    userId: String(data.userId ?? ''),
    userPhoto: String(data.userPhoto ?? ''),
    hashtags: Array.isArray(data.hashtags)
      ? data.hashtags.map(String)
      : [],
    soundId: String(data.soundId ?? ''),
    videoURL: String(
      data.videoURL ?? data.videoUrl ?? '',
    ),
    thumbnailURL: String(
      data.thumbnailUrl ??
        data.thumbnailURL ??
        '',
    ),
    type: String(
      data.mediaType ?? data.type ?? 'video',
    ),
    mediaType: 'video',
    likeCount: Number(
      data.likeCount ?? data.likes ?? 0,
    ),
    commentCount: Number(
      data.commentCount ?? data.comments ?? 0,
    ),
    shareCount: Number(
      data.shareCount ?? data.shares ?? 0,
    ),
    saveCount: Number(
      data.saveCount ?? data.saves ?? 0,
    ),
    viewCount: Number(
      data.viewCount ?? data.views ?? 0,
    ),
    createdAt: Number(data.createdAt ?? 0),
  }
}

function filterBlockedVideos(
  hits: any[],
  blockedIds: Set<string>,
): any[] {
  return hits.filter((hit) => {
    const userId = String(
      hit.document.userId ?? '',
    )

    return !blockedIds.has(userId)
  })
}

export async function searchPosts(
  term: string,
  max = 8,
): Promise<PostResult[]> {
  const q = term.trim().replace(/^#/, '')

  if (!q) {
    return []
  }

  try {
    const blockedIds = await getBlockedUserIds()

    const result = await withTypesenseRetry(
      () =>
        searchClient
          .collections('posts')
          .documents()
          .search({
            q,
            query_by: 'text,userName,hashtags,soundId,city',
            query_by_weights: '4,3,2,1,1',
            sort_by:
              '_text_match:desc,recencyScore:desc,createdAt:desc',
            num_typos: 2,
            per_page: Math.min(max * 2, 40),
            filter_by: SEARCH_FILTER_BY,
          }),
      {
        context: 'searchPosts',
      },
    )

    return (result.data?.hits ?? [])
      .filter((hit: any) => {
        const userId = String(
          hit.document?.userId ?? '',
        )

        return !blockedIds.has(userId)
      })
      .slice(0, max)
      .map(mapPostHit)
  } catch (error) {
    captureException(
      error instanceof Error
        ? error
        : new Error(String(error)),
      { context: 'searchPosts' },
    )

    return []
  }
}

async function searchVideosByText(
  term: string,
  max: number,
): Promise<VideoResult[]> {
  const q = term.trim().replace(/^#/, '')

  if (!q) {
    return []
  }

  const blockedIds = await getBlockedUserIds()

  const result = await withTypesenseRetry(
    () =>
      searchClient
        .collections('videos')
        .documents()
        .search({
          q,
          query_by:
            'text,description,userName,hashtags,soundId,city',
          query_by_weights: '5,4,3,2,1,1',
          sort_by:
            '_text_match:desc,hotScore:desc,createdAt:desc',
          num_typos: 2,
          per_page: Math.min(max * 2, 40),
          filter_by:
            'visibility:=public && ' +
            'moderationStatus:!=hidden && ' +
            'moderationStatus:!=blocked',
        }),
    {
      context: 'searchVideosByText',
    },
  )

  return (result.data?.hits ?? [])
    .filter((hit: any) => {
      const userId = String(
        hit.document?.userId ?? '',
      )

      return !blockedIds.has(userId)
    })
    .slice(0, max)
    .map(mapVideoHit)
}

export async function searchVideos(
  term: string,
  max = 8,
): Promise<PostResult[]> {
  const videos = await searchVideosByText(term, max)

  return videos.map((video) => ({
    id: video.id,
    description: video.description,
    text: video.text,
    thumbnailUrl: video.thumbnailURL,
    mediaUrl: video.videoURL,
    userName: video.userName,
    userPhoto: video.userPhoto,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    viewCount: video.viewCount,
    mediaType: 'video',
    createdAt: video.createdAt,
  }))
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

export async function searchAll(
  term: string,
): Promise<SearchResults> {
  const cleanTerm = term.trim()

  if (!cleanTerm) {
    return {
      users: [],
      hashtags: [],
      posts: [],
      videos: [],
    }
  }

  if (cleanTerm.startsWith('#')) {
    const videos = await searchVideosByHashtag(cleanTerm)

    return {
      users: [],
      hashtags: [],
      posts: [],
      videos,
    }
  }

  const result = await searchMulti(cleanTerm)

  return {
    users: result.users.hits.map(
      (hit) => hit.document,
    ),
    hashtags: result.hashtags.hits.map(
      (hit) => hit.document,
    ),
    posts: result.posts.hits.map(mapPostHit),
    videos: result.videos.hits.map(mapVideoHit),
  }
}

export async function searchMulti(
  term: string,
): Promise<MultiSearchResult> {
  const q = term.trim().replace(/^#/, '').toLowerCase()

  const emptyResult: MultiSearchResult = {
    users: {
      hits: [],
      found: 0,
      request_params: {},
    },
    hashtags: {
      hits: [],
      found: 0,
      request_params: {},
    },
    posts: {
      hits: [],
      found: 0,
      request_params: {},
    },
    videos: {
      hits: [],
      found: 0,
      request_params: {},
    },
  }

  if (!q) {
    return emptyResult
  }

  const blockedIds = await getBlockedUserIds()
  const cacheKey = [
    'searchMulti',
    q,
    auth.currentUser?.uid ?? 'anonymous',
    [...blockedIds].sort().join(','),
  ].join(':')

  const cached = getCached<MultiSearchResult>(cacheKey)

  if (cached) {
    return cached
  }

  const [
    usersResult,
    hashtagsResult,
    postsResult,
    videosResult,
  ] = await Promise.all([
    withTypesenseRetry(
      () =>
        searchClient
          .collections('users')
          .documents()
          .search({
            q,
            query_by: 'pseudo,nom,bio,city',
            query_by_weights: '4,3,1,1',
            sort_by: '_text_match:desc,followerCount:desc',
            num_typos: 2,
            per_page: 20,
          }),
      { context: 'searchMulti.users' },
    ),

    withTypesenseRetry(
      () =>
        searchClient
          .collections('hashtags')
          .documents()
          .search({
            q,
            query_by: 'tag',
            sort_by:
              '_text_match:desc,trendingScore:desc,videoCount:desc',
            num_typos: 1,
            per_page: 10,
          }),
      { context: 'searchMulti.hashtags' },
    ),

    withTypesenseRetry(
      () =>
        searchClient
          .collections('posts')
          .documents()
          .search({
            q,
            query_by: 'text,userName',
            query_by_weights: '3,1',
            sort_by:
              '_text_match:desc,recencyScore:desc,createdAt:desc',
            num_typos: 2,
            per_page: 20,
            filter_by: SEARCH_FILTER_BY,
          }),
      { context: 'searchMulti.posts' },
    ),

    withTypesenseRetry(
      () =>
        searchClient
          .collections('videos')
          .documents()
          .search({
            q,
            query_by:
              'text,description,userName,hashtags,soundId,city',
            query_by_weights: '4,3,2,1,1',
            sort_by:
              '_text_match:desc,hotScore:desc,createdAt:desc',
            num_typos: 2,
            per_page: 30,
            filter_by:
              'visibility:=public && ' +
              'moderationStatus:!=hidden && ' +
              'moderationStatus:!=blocked',
          }),
      { context: 'searchMulti.videos' },
    ),
  ])

  const users = (usersResult.data?.hits ?? [])
    .filter((hit: any) => {
      const id = hit.document.id
      const me = auth.currentUser?.uid

      return id !== me && !blockedIds.has(id)
    })
    .slice(0, 10)

  const posts = (postsResult.data?.hits ?? [])
    .filter((hit: any) => {
      const userId = String(
        hit.document.userId ?? '',
      )

      return !blockedIds.has(userId)
    })
    .slice(0, 12)

  const videos = filterBlockedVideos(
    videosResult.data?.hits ?? [],
    blockedIds,
  ).slice(0, 20)

  const hashtags = hashtagsResult.data?.hits ?? []

  const result: MultiSearchResult = {
    users: {
      ...(usersResult.data ?? emptyResult.users),
      hits: users,
    },
    hashtags: {
      ...(hashtagsResult.data ?? emptyResult.hashtags),
      hits: hashtags,
    },
    posts: {
      ...(postsResult.data ?? emptyResult.posts),
      hits: posts,
    },
    videos: {
      ...(videosResult.data ?? emptyResult.videos),
      hits: videos,
    },
  }

  setCache(cacheKey, result)

  return result
}

export async function searchVideosByHashtag(
  hashtag: string,
  max = 30,
): Promise<VideoResult[]> {
  const q = hashtag
    .replace(/^#/, '')
    .trim()
    .toLowerCase()

  if (!q) {
    return []
  }

  const blockedIds = await getBlockedUserIds()

  const result = await withTypesenseRetry(
    () =>
      searchClient
        .collections('videos')
        .documents()
        .search({
          q: '*',
          query_by: 'description,userName,hashtags',
          filter_by:
            `hashtags:=${q} && ` +
            'moderationStatus:!=hidden && ' +
            'moderationStatus:!=blocked',
          sort_by:
            'hotScore:desc,createdAt:desc',
          per_page: max * 2,
        }),
    {
      context: 'searchVideosByHashtag',
    },
  )

  return (result.data?.hits ?? [])
    .filter((hit: any) => {
      const userId = String(
        hit.document.userId ?? '',
      )

      return !blockedIds.has(userId)
    })
    .slice(0, max)
    .map(mapVideoHit)
}

export function normalizeAndMerge(
  multi: MultiSearchResult,
): MergedResult[] {
  const merged: MergedResult[] = []

  const addHits = (
    hits: any[],
    type: 'user' | 'hashtag' | 'post',
    mapper: (hit: any) => Partial<MergedResult>,
  ) => {
    const maxScore = Math.max(
      ...hits.map((hit) => hit.text_match ?? 0),
      1,
    )

    for (const hit of hits) {
      merged.push({
        id: String(hit.document.id),
        type,
        normalizedScore:
          (hit.text_match ?? 0) / maxScore,
        ...mapper(hit),
      })
    }
  }

  addHits(multi.users.hits, 'user', (hit) => ({
    user: hit.document as UserResult,
  }))

  addHits(multi.hashtags.hits, 'hashtag', (hit) => ({
    id: String(
      hit.document.tag ?? hit.document.id,
    ),
    hashtag: hit.document as HashtagResult,
  }))

  addHits(multi.posts.hits, 'post', (hit) => ({
    post: mapPostHit(hit),
  }))

  const videoScores = Math.max(
    ...multi.videos.hits.map(
      (hit) => hit.text_match ?? 0,
    ),
    1,
  )

  for (const hit of multi.videos.hits) {
    merged.push({
      id: `video:${hit.document.id}`,
      type: 'post',
      normalizedScore:
        (hit.text_match ?? 0) / videoScores,
      post: {
        id: String(hit.document.id),
        description: String(
          hit.document.description ?? '',
        ),
        text: String(
          hit.document.description ?? '',
        ),
        userName: String(
          hit.document.userName ?? '',
        ),
        userPhoto: String(
          hit.document.userPhoto ?? '',
        ),
        thumbnailUrl: String(
          hit.document.thumbnailUrl ??
            hit.document.thumbnailURL ??
            '',
        ),
        mediaUrl: String(
          hit.document.videoURL ?? '',
        ),
        mediaType: 'video',
        likeCount: Number(
          hit.document.likeCount ??
            hit.document.likes ??
            0,
        ),
        commentCount: Number(
          hit.document.commentCount ??
            hit.document.comments ??
            0,
        ),
        shareCount: Number(
          hit.document.shareCount ??
            hit.document.shares ??
            0,
        ),
        saveCount: Number(
          hit.document.saveCount ??
            hit.document.saves ??
            0,
        ),
        viewCount: Number(
          hit.document.viewCount ??
            hit.document.views ??
            0,
        ),
        createdAt: Number(
          hit.document.createdAt ?? 0,
        ),
      },
    })
  }

  return merged.sort((a, b) => {
    if (b.normalizedScore !== a.normalizedScore) {
      return b.normalizedScore - a.normalizedScore
    }

    return a.id.localeCompare(b.id)
  })
}

export function filterPostsByType(posts: PostResult[], types: PostMediaType[]): PostResult[] {
  return posts.filter((p) => p.mediaType && types.includes(p.mediaType))
}
