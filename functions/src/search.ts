import {
  onDocumentWritten,
} from 'firebase-functions/v2/firestore'

import {
  onCall,
  HttpsError,
} from 'firebase-functions/v2/https'

import {
  defineSecret,
} from 'firebase-functions/params'

import {
  getFirestore,
  Timestamp,
} from 'firebase-admin/firestore'

import Typesense from 'typesense'

import {
  USERS_SCHEMA,
  HASHTAGS_SCHEMA,
  POSTS_SCHEMA,
  VIDEOS_SCHEMA,
} from '../../src/lib/typesense-schemas'

const TYPESENSE_HOST = defineSecret('TYPESENSE_HOST')
const TYPESENSE_ADMIN_KEY = defineSecret('TYPESENSE_ADMIN_KEY')

const SECRETS = [
  TYPESENSE_HOST,
  TYPESENSE_ADMIN_KEY,
]

const BACKFILL_PAGE_SIZE = 300

type PostMediaType =
  | 'text'
  | 'image'
  | 'carousel'
  | 'article'
  | 'video'
  | 'video_share'

type SearchDocument = Record<string, unknown>

function client(): Typesense.Client {
  return new Typesense.Client({
    nodes: [
      {
        host: TYPESENSE_HOST.value(),
        port: 443,
        protocol: 'https',
      },
    ],
    apiKey: TYPESENSE_ADMIN_KEY.value(),
    connectionTimeoutSeconds: 5,
  })
}

function toMs(
  value:
    | Timestamp
    | { seconds: number }
    | number
    | undefined
    | null,
): number {
  if (!value) {
    return 0
  }

  if (typeof value === 'number') {
    return value
  }

  if (
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    return value.toMillis()
  }

  if (
    typeof value === 'object' &&
    'seconds' in value
  ) {
    return Number(value.seconds) * 1000
  }

  return 0
}

function normalizeHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === 'string',
    )
    .map((item) =>
      item
        .trim()
        .toLowerCase()
        .replace(/^#/, ''),
    )
    .filter(Boolean)
}

function getVisibility(value: unknown): string {
  return typeof value === 'string'
    ? value
    : 'public'
}

function getModerationStatus(value: unknown): string {
  return typeof value === 'string'
    ? value
    : 'approved'
}

function computeEngagementScore(
  likeCount: number,
  commentCount: number,
  shareCount: number,
  saveCount: number,
  viewCount: number,
): number {
  return (
    Math.log1p(Math.max(0, likeCount)) * 1 +
    Math.log1p(Math.max(0, commentCount)) * 1.5 +
    Math.log1p(Math.max(0, shareCount)) * 2 +
    Math.log1p(Math.max(0, saveCount)) * 1.8 +
    Math.log1p(Math.max(0, viewCount)) * 0.2
  )
}

function computeRecencyScore(
  createdAtMs: number,
  engagementScore: number,
): number {
  if (!createdAtMs) {
    return engagementScore
  }

  const ageHours = Math.max(
    0,
    (Date.now() - createdAtMs) /
      (1000 * 60 * 60),
  )

  const freshness = Math.exp(-ageHours / 24)

  return (
    freshness * 3 +
    engagementScore * 0.7
  )
}

function computeHotScore(
  createdAtMs: number,
  engagementScore: number,
): number {
  if (!createdAtMs) {
    return engagementScore
  }

  const ageHours = Math.max(
    0,
    (Date.now() - createdAtMs) /
      (1000 * 60 * 60),
  )

  const freshness = Math.exp(-ageHours / 48)

  return (
    freshness * 4 +
    engagementScore * 0.8
  )
}

function getNumber(
  value: unknown,
  fallback = 0,
): number {
  const parsed = Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

function getString(
  value: unknown,
  fallback = '',
): string {
  return typeof value === 'string'
    ? value
    : fallback
}

function getFirstMedia(
  data: FirebaseFirestore.DocumentData,
): FirebaseFirestore.DocumentData {
  if (
    Array.isArray(data.media) &&
    data.media.length > 0 &&
    data.media[0] &&
    typeof data.media[0] === 'object'
  ) {
    return data.media[0]
  }

  return {}
}

function mapUser(
  data: FirebaseFirestore.DocumentData,
  id: string,
): SearchDocument {
  return {
    id,
    pseudo: getString(data.pseudo),
    nom: getString(data.nom),
    bio: getString(data.bio),
    city: getString(data.city),
    interests: Array.isArray(data.interests)
      ? data.interests
          .filter(
            (item): item is string =>
              typeof item === 'string',
          )
          .slice(0, 20)
      : [],
    photoURL: getString(
      data.photoURL ?? data.userPhotoURL,
    ),
    verified: Boolean(data.verified),
    followerCount: getNumber(data.followerCount),
  }
}

function mapHashtag(
  data: FirebaseFirestore.DocumentData,
  id: string,
): SearchDocument {
  return {
    id,
    tag: getString(data.tag, id)
      .trim()
      .replace(/^#/, '')
      .toLowerCase(),
    videoCount: getNumber(data.videoCount),
    trendingScore: getNumber(data.trendingScore),
  }
}

function mapPost(
  data: FirebaseFirestore.DocumentData,
  id: string,
  authorCity = '',
): SearchDocument {
  const likeCount = getNumber(
    data.likes ?? data.likeCount,
  )

  const commentCount = getNumber(
    data.comments ?? data.commentCount,
  )

  const shareCount = getNumber(
    data.shares ?? data.shareCount,
  )

  const saveCount = getNumber(
    data.saves ?? data.saveCount,
  )

  const viewCount = getNumber(
    data.views ?? data.viewCount,
  )

  const firstMedia = getFirstMedia(data)

  const mediaUrl = getString(
    data.mediaUrl ??
      firstMedia.url,
  )

  const thumbnailUrl = getString(
    data.thumbnailUrl ??
      data.thumbnailURL ??
      firstMedia.thumbnailUrl ??
      mediaUrl,
  )

  const mediaType = getString(
    data.mediaType ??
      firstMedia.type ??
      (Array.isArray(data.media)
        ? data.media.length > 1
          ? 'carousel'
          : data.media.length === 1
            ? 'image'
            : 'text'
        : 'text'),
  ) as PostMediaType

  const createdAt = toMs(data.createdAt)

  const engagementScore = computeEngagementScore(
    likeCount,
    commentCount,
    shareCount,
    saveCount,
    viewCount,
  )

  return {
    id,
    text: getString(
      data.text ?? data.description,
    ),
    userName: getString(data.userName),
    userId: getString(data.userId),
    userPhoto: getString(
      data.userPhoto ??
        data.userPhotoURL ??
        data.authorPhoto,
    ),
    city: getString(
      data.city ?? authorCity,
    ),
    hashtags: normalizeHashtags(data.hashtags),
    soundId: getString(data.soundId),
    likeCount,
    commentCount,
    shareCount,
    saveCount,
    viewCount,
    mediaType,
    mediaUrl,
    thumbnailUrl,
    createdAt,
    visibility: getVisibility(data.visibility),
    moderationStatus: getModerationStatus(
      data.moderationStatus,
    ),
    engagementScore,
    recencyScore: computeRecencyScore(
      createdAt,
      engagementScore,
    ),
  }
}

function mapVideo(
  data: FirebaseFirestore.DocumentData,
  id: string,
  authorCity = '',
): SearchDocument {
  const likeCount = getNumber(data.likes)
  const commentCount = getNumber(data.comments)
  const shareCount = getNumber(data.shares)
  const saveCount = getNumber(data.saves)
  const viewCount = getNumber(data.views)

  const createdAt = toMs(data.createdAt)

  const videoURL = getString(
    data.videoURL ?? data.videoUrl,
  )

  const thumbnailUrl = getString(
    data.thumbnailURL ??
      data.thumbnailUrl,
  )

  const engagementScore = computeEngagementScore(
    likeCount,
    commentCount,
    shareCount,
    saveCount,
    viewCount,
  )

  return {
    id,
    text: getString(
      data.description ?? data.text,
    ),
    description: getString(
      data.description ?? data.text,
    ),
    userName: getString(data.userName),
    userId: getString(data.userId),
    userPhoto: getString(
      data.userPhotoURL ??
        data.userPhoto,
    ),
    city: getString(
      data.city ?? authorCity,
    ),
    hashtags: normalizeHashtags(data.hashtags),
    soundId: getString(data.soundId),
    likeCount,
    commentCount,
    shareCount,
    saveCount,
    viewCount,
    mediaType: 'video',
    videoURL,
    videoURL_360p: getString(
      data.videoURL_360p,
    ),
    videoURL_480p: getString(
      data.videoURL_480p,
    ),
    thumbnailUrl,
    createdAt,
    visibility: getVisibility(data.visibility),
    moderationStatus: getModerationStatus(
      data.moderationStatus,
    ),
    engagementScore,
    recencyScore: computeRecencyScore(
      createdAt,
      engagementScore,
    ),
    hotScore: getNumber(
      data.hotScore,
      computeHotScore(
        createdAt,
        engagementScore,
      ),
    ),
  }
}

async function getAuthorCity(
  db: FirebaseFirestore.Firestore,
  userId: string,
): Promise<string> {
  if (!userId) {
    return ''
  }

  try {
    const snapshot = await db
      .collection('users')
      .doc(userId)
      .get()

    return getString(snapshot.data()?.city)
  } catch {
    return ''
  }
}

async function enrichWithAuthorCity(
  db: FirebaseFirestore.Firestore,
  document: SearchDocument,
): Promise<SearchDocument> {
  const userId = getString(document.userId)

  if (document.city || !userId) {
    return document
  }

  const city = await getAuthorCity(db, userId)

  return {
    ...document,
    city,
  }
}

function shouldIndexPost(
  document: SearchDocument,
): boolean {
  const visibility = getString(
    document.visibility,
  )

  const moderationStatus = getString(
    document.moderationStatus,
  )

  return (
    visibility === 'public' &&
    moderationStatus !== 'blocked' &&
    moderationStatus !== 'hidden'
  )
}

function shouldIndexVideo(
  data: FirebaseFirestore.DocumentData,
): boolean {
  const visibility = getVisibility(data.visibility)
  const moderationStatus = getModerationStatus(
    data.moderationStatus,
  )

  return (
    Boolean(
      data.videoURL ?? data.videoUrl,
    ) &&
    visibility === 'public' &&
    moderationStatus !== 'blocked' &&
    moderationStatus !== 'hidden' &&
    data.corrupted !== true
  )
}

async function upsertDocument(
  collectionName: string,
  document: SearchDocument,
): Promise<void> {
  const ts = client()

  await ts
    .collections(collectionName)
    .documents()
    .upsert(document)
}

async function deleteDocument(
  collectionName: string,
  id: string,
): Promise<void> {
  const ts = client()

  await ts
    .collections(collectionName)
    .documents(id)
    .delete()
    .catch(() => {})
}

export const syncUserToSearch = onDocumentWritten(
  {
    document: 'users/{uid}',
    secrets: SECRETS,
  },
  async (event) => {
    const uid = event.params.uid
    const after = event.data?.after.data()

    if (!after) {
      await deleteDocument('users', uid)
      return
    }

    try {
      await upsertDocument(
        'users',
        mapUser(after, uid),
      )
    } catch (error) {
      console.warn(
        'syncUser failed:',
        error instanceof Error
          ? error.message
          : error,
      )
    }
  },
)

export const syncHashtagToSearch = onDocumentWritten(
  {
    document: 'hashtags/{tag}',
    secrets: SECRETS,
  },
  async (event) => {
    const tag = event.params.tag
    const after = event.data?.after.data()

    if (
      !after ||
      getNumber(after.videoCount) <= 0
    ) {
      await deleteDocument('hashtags', tag)
      return
    }

    try {
      await upsertDocument(
        'hashtags',
        mapHashtag(after, tag),
      )
    } catch (error) {
      console.warn(
        'syncHashtag failed:',
        error instanceof Error
          ? error.message
          : error,
      )
    }
  },
)

export const syncPostToSearch = onDocumentWritten(
  {
    document: 'posts/{postId}',
    secrets: SECRETS,
  },
  async (event) => {
    const postId = event.params.postId
    const after = event.data?.after.data()

    if (!after) {
      await deleteDocument('posts', postId)
      return
    }

    const db = getFirestore()
    const rawPost = mapPost(after, postId)
    const post = await enrichWithAuthorCity(
      db,
      rawPost,
    )

    if (!shouldIndexPost(post)) {
      await deleteDocument('posts', postId)
      return
    }

    try {
      await upsertDocument('posts', post)
    } catch (error) {
      console.warn(
        'syncPost failed:',
        error instanceof Error
          ? error.message
          : error,
      )
    }
  },
)

export const syncVideoToSearch = onDocumentWritten(
  {
    document: 'videos/{videoId}',
    secrets: SECRETS,
  },
  async (event) => {
    const videoId = event.params.videoId
    const after = event.data?.after.data()

    if (!after) {
      await deleteDocument('videos', videoId)
      return
    }

    if (!shouldIndexVideo(after)) {
      await deleteDocument('videos', videoId)
      return
    }

    const db = getFirestore()
    const rawVideo = mapVideo(after, videoId)
    const video = await enrichWithAuthorCity(
      db,
      rawVideo,
    )

    try {
      await upsertDocument('videos', video)
    } catch (error) {
      console.warn(
        'syncVideo failed:',
        error instanceof Error
          ? error.message
          : error,
      )
    }
  },
)

export const initSearchSchema = onCall(
  {
    secrets: SECRETS,
  },
  async (request) => {
    if (!request.auth?.token?.admin) {
      throw new HttpsError(
        'permission-denied',
        'Admin only',
      )
    }

    const ts = client()

    const schemas = [
      USERS_SCHEMA,
      HASHTAGS_SCHEMA,
      POSTS_SCHEMA,
      VIDEOS_SCHEMA,
    ]

    for (const schema of schemas) {
      await ts
        .collections(schema.name)
        .delete()
        .catch(() => {})

      await ts
        .collections()
        .create(schema as any)
    }

    return {
      ok: true,
      created: [
        'users',
        'hashtags',
        'posts',
        'videos',
      ],
    }
  },
)

async function readAllUsers(
  db: FirebaseFirestore.Firestore,
): Promise<SearchDocument[]> {
  const snapshot = await db
    .collection('users')
    .get()

  return snapshot.docs.map((document) =>
    mapUser(document.data(), document.id),
  )
}

async function readAllHashtags(
  db: FirebaseFirestore.Firestore,
): Promise<SearchDocument[]> {
  const snapshot = await db
    .collection('hashtags')
    .get()

  return snapshot.docs
    .map((document) =>
      mapHashtag(document.data(), document.id),
    )
    .filter(
      (document) =>
        getNumber(document.videoCount) > 0,
    )
}

async function readAllPosts(
  db: FirebaseFirestore.Firestore,
): Promise<SearchDocument[]> {
  const documents: SearchDocument[] = []
  let lastDocument:
    | FirebaseFirestore.QueryDocumentSnapshot
    | undefined

  while (true) {
    let postsQuery = db
      .collection('posts')
      .where('visibility', '==', 'public')
      .orderBy('createdAt', 'desc')
      .limit(BACKFILL_PAGE_SIZE)

    if (lastDocument) {
      postsQuery = postsQuery.startAfter(lastDocument)
    }

    const snapshot = await postsQuery.get()

    if (snapshot.empty) {
      break
    }

    for (const document of snapshot.docs) {
      const rawPost = mapPost(
        document.data(),
        document.id,
      )

      const post = await enrichWithAuthorCity(
        db,
        rawPost,
      )

      if (shouldIndexPost(post)) {
        documents.push(post)
      }
    }

    lastDocument =
      snapshot.docs[snapshot.docs.length - 1]

    if (
      snapshot.docs.length < BACKFILL_PAGE_SIZE
    ) {
      break
    }
  }

  return documents
}

async function readAllVideos(
  db: FirebaseFirestore.Firestore,
): Promise<SearchDocument[]> {
  const documents: SearchDocument[] = []
  let lastDocument:
    | FirebaseFirestore.QueryDocumentSnapshot
    | undefined

  while (true) {
    let videosQuery = db
      .collection('videos')
      .where('visibility', '==', 'public')
      .orderBy('createdAt', 'desc')
      .limit(BACKFILL_PAGE_SIZE)

    if (lastDocument) {
      videosQuery = videosQuery.startAfter(lastDocument)
    }

    const snapshot = await videosQuery.get()

    if (snapshot.empty) {
      break
    }

    for (const document of snapshot.docs) {
      const data = document.data()

      if (!shouldIndexVideo(data)) {
        continue
      }

      const rawVideo = mapVideo(
        data,
        document.id,
      )

      const video = await enrichWithAuthorCity(
        db,
        rawVideo,
      )

      documents.push(video)
    }

    lastDocument =
      snapshot.docs[snapshot.docs.length - 1]

    if (
      snapshot.docs.length < BACKFILL_PAGE_SIZE
    ) {
      break
    }
  }

  return documents
}

export const backfillSearch = onCall(
  {
    secrets: SECRETS,
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth?.token?.admin) {
      throw new HttpsError(
        'permission-denied',
        'Admin only',
      )
    }

    const db = getFirestore()
    const ts = client()

    const [
      users,
      hashtags,
      posts,
      videos,
    ] = await Promise.all([
      readAllUsers(db),
      readAllHashtags(db),
      readAllPosts(db),
      readAllVideos(db),
    ])

    if (users.length > 0) {
      await ts
        .collections('users')
        .documents()
        .import(users, { action: 'upsert' })
    }

    if (hashtags.length > 0) {
      await ts
        .collections('hashtags')
        .documents()
        .import(hashtags, { action: 'upsert' })
    }

    if (posts.length > 0) {
      await ts
        .collections('posts')
        .documents()
        .import(posts, { action: 'upsert' })
    }

    if (videos.length > 0) {
      await ts
        .collections('videos')
        .documents()
        .import(videos, { action: 'upsert' })
    }

    return {
      ok: true,
      users: users.length,
      hashtags: hashtags.length,
      posts: posts.length,
      videos: videos.length,
    }
  },
)
