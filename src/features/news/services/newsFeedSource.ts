/* newsFeedSource — source unique du fil d'actualité.
   Singleton qui encapsule fetch + ranking + pagination.
   Pattern identique à forYouFeedSource.ts. */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import { rankPosts, type PostUserTaste } from './postRanking'
import { buildPostUserTaste } from './buildPostUserTaste'
import type { NewsPost } from '../types'

const PAGE_SIZE = 20
const FOLLOWING_CHUNK_SIZE = 30
const MAX_CONCURRENT_FOLLOWING_QUERIES = 3

type PostSnapshot = QueryDocumentSnapshot<DocumentData>

interface FollowingCursor {
  ids: string[]
  lastDoc: PostSnapshot | null
  exhausted: boolean
}

export interface NewsFeedPage {
  posts: NewsPost[]
  isFirst: boolean
  hasMore: boolean
}

function mapDocToPost(snapshot: PostSnapshot): NewsPost {
  const data = snapshot.data() as Record<string, any>
  const createdAt =
    typeof data.createdAt?.toDate === 'function'
      ? data.createdAt.toDate()
      : data.createdAt instanceof Date
        ? data.createdAt
        : new Date()

  return {
    id: snapshot.id,
    userId: String(data.userId ?? ''),
    userName: String(data.userName ?? ''),
    userPhotoURL: data.userPhotoURL ?? undefined,
    text: String(data.text ?? ''),
    format: data.format ?? 'text',
    media: Array.isArray(data.media) ? data.media : [],
    visibility: data.visibility ?? 'public',
    commentsEnabled: data.commentsEnabled !== false,
    likes: Number(data.likes ?? 0),
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    comments: Number(data.comments ?? 0),
    shares: Number(data.shares ?? 0),
    saves: Number(data.saves ?? 0),
    savedBy: Array.isArray(data.savedBy) ? data.savedBy : [],
    createdAt,
    updatedAt:
      typeof data.updatedAt?.toDate === 'function'
        ? data.updatedAt.toDate()
        : undefined,
    background: data.background,
    location: data.location,
    mood: data.mood,
    poll: data.poll,
    reactionCounts: data.reactionCounts,
    myReaction: data.myReaction ?? undefined,
    article: data.article,
    videoShare: data.videoShare,
    rankingScore:
      typeof data.rankingScore === 'number'
        ? data.rankingScore
        : undefined,
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0

  async function runWorker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) {
        return
      }

      results[currentIndex] = await worker(items[currentIndex])
    }
  }

  const workers = Array.from(
    {
      length: Math.min(concurrency, items.length),
    },
    () => runWorker(),
  )

  await Promise.all(workers)

  return results
}

class NewsFeedSource {
  private lastPublicDoc: PostSnapshot | null = null
  private lastOwnDoc: PostSnapshot | null = null

  private followingCursors: FollowingCursor[] = []

  private pendingPosts: NewsPost[] = []
  private pendingIds = new Set<string>()

  private isFirstFetch = true
  private loading = false
  private hasMoreValue = true

  private publicSourceExhausted = false
  private ownSourceExhausted = false

  private blockedIds = new Set<string>()
  private followingIds: string[] = []
  private userDataLoaded = false

  private taste: PostUserTaste = {
    likedAuthors: {},
    likedHashtags: {},
  }

  private tasteLoaded = false

  get isLoading(): boolean {
    return this.loading
  }

  get hasMoreFlag(): boolean {
    return this.hasMoreValue || this.pendingPosts.length > 0
  }

  private async loadUserData(uid: string): Promise<void> {
    if (this.userDataLoaded) {
      return
    }

    try {
      const snapshot = await getDoc(doc(db, 'users', uid))

      if (snapshot.exists()) {
        const data = snapshot.data()

        this.blockedIds = new Set(
          Array.isArray(data.blocked) ? data.blocked : [],
        )

        const rawFollowing: unknown = data.following
        this.followingIds = Array.isArray(rawFollowing)
          ? rawFollowing.filter(
              (value: unknown): value is string =>
                typeof value === 'string',
            )
          : []
      }

      this.followingCursors = chunk(
        this.followingIds,
        FOLLOWING_CHUNK_SIZE,
      ).map((ids) => ({
        ids,
        lastDoc: null,
        exhausted: false,
      }))

      this.userDataLoaded = true
    } catch (error) {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          context: 'newsFeedSource.loadUserData',
        },
      )

      this.userDataLoaded = true
    }
  }

  private async loadTaste(uid: string): Promise<void> {
    if (this.tasteLoaded) {
      return
    }

    try {
      this.taste = await buildPostUserTaste(uid)
    } catch (error) {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          context: 'newsFeedSource.loadTaste',
        },
      )

      this.taste = {
        likedAuthors: {},
        likedHashtags: {},
      }
    } finally {
      this.tasteLoaded = true
    }
  }

  private async fetchPublicPage(): Promise<NewsPost[]> {
    if (this.publicSourceExhausted) {
      return []
    }

    const constraints: any[] = [
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    ]

    if (this.lastPublicDoc) {
      constraints.push(startAfter(this.lastPublicDoc))
    }

    const snapshot = await getDocs(
      query(collection(db, 'posts'), ...constraints),
    )

    if (snapshot.docs.length > 0) {
      this.lastPublicDoc =
        snapshot.docs[snapshot.docs.length - 1]
    }

    if (snapshot.docs.length < PAGE_SIZE) {
      this.publicSourceExhausted = true
    }

    return snapshot.docs.map(mapDocToPost)
  }

  private async fetchOwnPage(uid: string): Promise<NewsPost[]> {
    if (this.ownSourceExhausted) {
      return []
    }

    const constraints: any[] = [
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    ]

    if (this.lastOwnDoc) {
      constraints.push(startAfter(this.lastOwnDoc))
    }

    const snapshot = await getDocs(
      query(collection(db, 'posts'), ...constraints),
    )

    if (snapshot.docs.length > 0) {
      this.lastOwnDoc =
        snapshot.docs[snapshot.docs.length - 1]
    }

    if (snapshot.docs.length < PAGE_SIZE) {
      this.ownSourceExhausted = true
    }

    return snapshot.docs.map(mapDocToPost)
  }

  private async fetchFollowingChunk(
    cursor: FollowingCursor,
  ): Promise<NewsPost[]> {
    if (cursor.exhausted || cursor.ids.length === 0) {
      return []
    }

    const constraints: any[] = [
      where('userId', 'in', cursor.ids),
      where('visibility', '==', 'followers'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    ]

    if (cursor.lastDoc) {
      constraints.push(startAfter(cursor.lastDoc))
    }

    const snapshot = await getDocs(
      query(collection(db, 'posts'), ...constraints),
    )

    if (snapshot.docs.length > 0) {
      cursor.lastDoc = snapshot.docs[snapshot.docs.length - 1]
    }

    if (snapshot.docs.length < PAGE_SIZE) {
      cursor.exhausted = true
    }

    return snapshot.docs.map(mapDocToPost)
  }

  private async fetchRawBatch(uid: string): Promise<NewsPost[]> {
    const followingResults = await mapWithConcurrency(
      this.followingCursors.filter((cursor) => !cursor.exhausted),
      MAX_CONCURRENT_FOLLOWING_QUERIES,
      (cursor) => this.fetchFollowingChunk(cursor),
    )

    const results = await Promise.all([
      this.fetchPublicPage(),
      this.fetchOwnPage(uid),
    ])

    const allPosts = [
      ...results[0],
      ...results[1],
      ...followingResults.flat(),
    ]

    const seen = new Set<string>()

    return allPosts.filter((post) => {
      if (seen.has(post.id)) {
        return false
      }

      if (this.blockedIds.has(post.userId)) {
        return false
      }

      if (!post.userId) {
        return false
      }

      seen.add(post.id)
      return true
    })
  }

  private pushToPending(posts: NewsPost[]): void {
    const unique = posts.filter((post) => {
      if (this.pendingIds.has(post.id)) {
        return false
      }

      this.pendingIds.add(post.id)
      return true
    })

    if (unique.length === 0) {
      return
    }

    const ranked = rankPosts(
      [...this.pendingPosts, ...unique],
      this.taste,
    )

    this.pendingPosts = ranked
  }

  private hasRawSourcesRemaining(): boolean {
    const followingRemaining = this.followingCursors.some(
      (cursor) => !cursor.exhausted,
    )

    return (
      !this.publicSourceExhausted ||
      !this.ownSourceExhausted ||
      followingRemaining
    )
  }

  async fetchNext(): Promise<NewsFeedPage | null> {
    if (this.loading || !this.hasMoreFlag) {
      return null
    }

    const uid = auth.currentUser?.uid

    if (!uid) {
      return null
    }

    this.loading = true

    try {
      await this.loadUserData(uid)
      await this.loadTaste(uid)

      const isFirst = this.isFirstFetch

      // On remplit le buffer jusqu'à pouvoir servir une page complète.
      while (
        this.pendingPosts.length < PAGE_SIZE &&
        this.hasRawSourcesRemaining()
      ) {
        const rawPosts = await this.fetchRawBatch(uid)

        this.pushToPending(rawPosts)

        // Évite une boucle infinie si Firestore ne renvoie rien.
        if (rawPosts.length === 0 && !this.hasRawSourcesRemaining()) {
          break
        }

        if (rawPosts.length === 0) {
          const stillMoving = this.hasRawSourcesRemaining()

          if (!stillMoving) {
            break
          }
        }
      }

      const posts = this.pendingPosts.slice(0, PAGE_SIZE)

      this.pendingPosts = this.pendingPosts.slice(PAGE_SIZE)

      for (const post of posts) {
        this.pendingIds.delete(post.id)
      }

      this.hasMoreValue =
        this.pendingPosts.length > 0 ||
        this.hasRawSourcesRemaining()

      this.isFirstFetch = false

      return {
        posts,
        isFirst,
        hasMore: this.hasMoreValue,
      }
    } catch (error) {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          context: 'newsFeedSource.fetchNext',
        },
      )

      return null
    } finally {
      this.loading = false
    }
  }

  reset(): void {
    this.lastPublicDoc = null
    this.lastOwnDoc = null
    this.followingCursors = []

    this.pendingPosts = []
    this.pendingIds.clear()

    this.isFirstFetch = true
    this.loading = false
    this.hasMoreValue = true

    this.publicSourceExhausted = false
    this.ownSourceExhausted = false

    this.blockedIds = new Set()
    this.followingIds = []
    this.userDataLoaded = false

    this.taste = {
      likedAuthors: {},
      likedHashtags: {},
    }
    this.tasteLoaded = false
  }

  invalidateUserData(): void {
    this.userDataLoaded = false
    this.tasteLoaded = false
  }
}

export const newsFeedSource = new NewsFeedSource()
