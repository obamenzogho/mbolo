/* newsFeedSource — source unique du fil d'actualité.
   Singleton qui encapsule fetch + ranking + pagination.
   Pattern identique à forYouFeedSource.ts. */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  startAfter,
  where,
  doc,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { auth } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import { rankPosts, type PostUserTaste } from './postRanking'
import { buildPostUserTaste } from './buildPostUserTaste'
import type { NewsPost } from '../types'

const PAGE_SIZE = 20
const MIN_KEEP = 5
const MAX_EXTRA_FETCHES = 3

export interface NewsFeedPage {
  posts: NewsPost[]
  isFirst: boolean
  hasMore: boolean
}

function mapDocToPost(d: QueryDocumentSnapshot): NewsPost {
  const data = d.data() as any
  return {
    id: d.id,
    userId: data.userId,
    userName: data.userName ?? '',
    userPhotoURL: data.userPhotoURL ?? undefined,
    text: data.text || '',
    format: data.format || 'text',
    media: data.media ?? [],
    visibility: data.visibility || 'public',
    commentsEnabled: data.commentsEnabled !== false,
    likes: data.likes ?? 0,
    likedBy: data.likedBy ?? [],
    comments: data.comments ?? 0,
    shares: data.shares ?? 0,
    saves: data.saves ?? 0,
    savedBy: data.savedBy ?? [],
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? undefined,
    background: data.background,
    location: data.location,
    mood: data.mood,
    poll: data.poll,
    reactionCounts: data.reactionCounts,
    myReaction: data.myReaction ?? undefined,
    article: data.article,
    videoShare: data.videoShare,
    rankingScore: data.rankingScore,
  }
}

class NewsFeedSource {
  // Cursors séparés pour chaque requête (3 requêtes mergées)
  private lastDocPublic: QueryDocumentSnapshot | null = null
  private lastDocFollowing: QueryDocumentSnapshot | null = null
  private lastDocOwn: QueryDocumentSnapshot | null = null
  private isFirstFetch = true
  private loading = false
  private extraFetches = 0
  private taste: PostUserTaste = { likedAuthors: {}, likedHashtags: {} }
  private tasteLoaded = false
  private blockedIds: Set<string> = new Set()
  private followingIds: string[] = []
  private userDataLoaded = false
  private hasMoreValue = true

  get isLoading() { return this.loading }
  get hasMoreFlag() { return this.hasMoreValue }

  async fetchNext(): Promise<NewsFeedPage | null> {
    if (this.loading || !this.hasMoreValue) return null
    this.loading = true

    try {
      const uid = auth.currentUser?.uid
      if (!uid) { this.loading = false; return null }

      // Charger les données utilisateur une seule fois (blocked + following)
      if (!this.userDataLoaded) {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid))
          if (userSnap.exists()) {
            const data = userSnap.data()
            this.blockedIds = new Set(data.blocked ?? [])
            this.followingIds = data.following ?? []
          }
        } catch (e) {
          captureException(e instanceof Error ? e : new Error(String(e)), { context: 'newsFeedSource.loadUserData' })
        }
        this.userDataLoaded = true
      }
      if (!this.tasteLoaded) {
        this.taste = await buildPostUserTaste(uid)
        this.tasteLoaded = true
      }

      const isFirst = this.isFirstFetch
      let allPosts: NewsPost[] = []
      let anyHasMore = false

      // 1) Posts publics
      try {
        const qPublic = this.lastDocPublic
          ? query(collection(db, 'posts'), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), startAfter(this.lastDocPublic), limit(PAGE_SIZE))
          : query(collection(db, 'posts'), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
        const snap = await getDocs(qPublic)
        if (snap.docs.length > 0) {
          this.lastDocPublic = snap.docs[snap.docs.length - 1]
          allPosts.push(...snap.docs.map(mapDocToPost))
          if (snap.docs.length >= PAGE_SIZE) anyHasMore = true
        }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'newsFeedSource.fetchPublic' })
    }

    // 2) Posts followers-only des abonnements
    if (this.followingIds.length > 0) {
      try {
        for (let i = 0; i < this.followingIds.length; i += 30) {
          const chunk = this.followingIds.slice(i, i + 30)
          const qFollowers = this.lastDocFollowing
            ? query(collection(db, 'posts'), where('userId', 'in', chunk), where('visibility', '==', 'followers'), orderBy('createdAt', 'desc'), startAfter(this.lastDocFollowing), limit(PAGE_SIZE))
            : query(collection(db, 'posts'), where('userId', 'in', chunk), where('visibility', '==', 'followers'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
          const snap = await getDocs(qFollowers)
          if (snap.docs.length > 0) {
            this.lastDocFollowing = snap.docs[snap.docs.length - 1]
            allPosts.push(...snap.docs.map(mapDocToPost))
            if (snap.docs.length >= PAGE_SIZE) anyHasMore = true
          }
        }
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'newsFeedSource.fetchFollowing' })
      }
    }

    // 3) Mes propres posts
    try {
      const qOwn = this.lastDocOwn
        ? query(collection(db, 'posts'), where('userId', '==', uid), orderBy('createdAt', 'desc'), startAfter(this.lastDocOwn), limit(PAGE_SIZE))
        : query(collection(db, 'posts'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
      const snap = await getDocs(qOwn)
      if (snap.docs.length > 0) {
        this.lastDocOwn = snap.docs[snap.docs.length - 1]
        allPosts.push(...snap.docs.map(mapDocToPost))
        if (snap.docs.length >= PAGE_SIZE) anyHasMore = true
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'newsFeedSource.fetchOwn' })
    }

      // Dedup + filtre blocked
      const seen = new Set<string>()
      allPosts = allPosts.filter((p) => {
        if (seen.has(p.id) || this.blockedIds.has(p.userId)) return false
        seen.add(p.id)
        return true
      })

      // Ranking client-side
      allPosts = rankPosts(allPosts, this.taste)

      // Sécurité : si trop peu de posts, fetch supplémentaire
      if (allPosts.length < MIN_KEEP && anyHasMore && this.extraFetches < MAX_EXTRA_FETCHES) {
        this.extraFetches++
        this.loading = false
        const next = await this.fetchNext()
        if (next) {
          allPosts = [...allPosts, ...next.posts]
          anyHasMore = next.hasMore
        }
      } else {
        this.extraFetches = 0
      }

      this.hasMoreValue = anyHasMore
      this.isFirstFetch = false
      this.loading = false

      return { posts: allPosts.slice(0, PAGE_SIZE), isFirst, hasMore: this.hasMoreValue }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'newsFeedSource' })
      this.loading = false
      return null
    }
  }

  reset() {
    this.lastDocPublic = null
    this.lastDocFollowing = null
    this.lastDocOwn = null
    this.isFirstFetch = true
    this.loading = false
    this.extraFetches = 0
    this.hasMoreValue = true
    this.tasteLoaded = false
    this.userDataLoaded = false
  }
}

export const newsFeedSource = new NewsFeedSource()
