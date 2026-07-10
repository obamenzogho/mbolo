import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  where,
  runTransaction,
  doc,
  increment,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  onSnapshot,
  updateDoc,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { getBlockedUserIds } from '@/lib/blockService'
import { notifyPostOwner } from '../services/newsNotifications'
import type { NewsPost, NewsPostMedia, NewsPostFormat } from '../types'

const PAGE_SIZE = 20

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function toDate(value: any): Date {
  if (!value) return new Date()
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000)
  }
  return new Date(value)
}

function normalizeMedia(value: unknown): NewsPostMedia[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item: any) => {
    if (!item || typeof item.url !== 'string') return []

    return [{
      url: item.url,
      type: item.type === 'video' ? 'video' : 'image',
      width: typeof item.width === 'number' ? item.width : undefined,
      height: typeof item.height === 'number' ? item.height : undefined,
      duration: typeof item.duration === 'number' ? item.duration : undefined,
      thumbnailUrl:
        typeof item.thumbnailUrl === 'string'
          ? item.thumbnailUrl
          : undefined,
    } satisfies NewsPostMedia]
  })
}

function inferFormat(media: NewsPostMedia[]): NewsPostFormat {
  if (media.length === 0) return 'text'
  if (media[0].type === 'video') return 'video'
  if (media.length > 1) return 'carousel'
  return 'image'
}

function mapPost(snapshot: QueryDocumentSnapshot): NewsPost {
  const data = snapshot.data()
  const media = normalizeMedia(data.media)

  return {
    id: snapshot.id,
    userId: data.userId,
    userName: data.userName || 'Utilisateur',
    userPhotoURL: data.userPhotoURL || undefined,
    text: data.text || '',
    format: data.format || inferFormat(media),
    media,
    visibility: data.visibility || 'public',
    commentsEnabled: data.commentsEnabled !== false,
    likes: data.likes ?? 0,
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    comments: data.comments ?? 0,
    shares: data.shares ?? 0,
    saves: data.saves ?? 0,
    savedBy: Array.isArray(data.savedBy) ? data.savedBy : [],
    createdAt: toDate(data.createdAt),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
  }
}

export function useNewsFeed() {
  const uid = auth.currentUser?.uid ?? ''
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [followingIds, setFollowingIds] = useState<string[]>([])

  const lastPublicRef = useRef<QueryDocumentSnapshot | null>(null)
  const lastFollowingRef = useRef<QueryDocumentSnapshot | null>(null)
  const requestRunningRef = useRef(false)

  useEffect(() => {
    if (!uid) {
      setFollowingIds([])
      return
    }

    return onSnapshot(doc(db, 'users', uid), (snapshot: any) => {
      const following = snapshot.data()?.following
      setFollowingIds(
        Array.isArray(following) ? following : [],
      )
    })
  }, [uid])

  const fetchPage = useCallback(async (reset = false) => {
    if (requestRunningRef.current) return
    if (!reset && !hasMore) return

    requestRunningRef.current = true

    if (reset) {
      setRefreshing(true)
      lastPublicRef.current = null
      lastFollowingRef.current = null
    } else if (posts.length === 0) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const blockedIds = await getBlockedUserIds()

      // Requête 1 : publications publiques
      const publicConstraints: any[] = [
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ]
      if (!reset && lastPublicRef.current) {
        publicConstraints.push(startAfter(lastPublicRef.current))
      }

      const publicSnap = await getDocs(
        query(collection(db, 'posts'), ...publicConstraints),
      )

      if (publicSnap.docs.length > 0) {
        lastPublicRef.current =
          publicSnap.docs[publicSnap.docs.length - 1]
      }

      // Requête 2 : publications "followers" des gens suivis
      let followersPage: QueryDocumentSnapshot[] = []

      if (followingIds.length > 0) {
        const chunks = chunk(followingIds, 30)

        for (const ids of chunks) {
          const followConstraints: any[] = [
            where('userId', 'in', ids),
            where('visibility', '==', 'followers'),
            orderBy('createdAt', 'desc'),
            limit(PAGE_SIZE),
          ]

          if (!reset && lastFollowingRef.current) {
            followConstraints.push(startAfter(lastFollowingRef.current))
          }

          const snap = await getDocs(
            query(collection(db, 'posts'), ...followConstraints),
          )

          followersPage.push(...snap.docs)
        }

        if (followersPage.length > 0) {
          lastFollowingRef.current =
            followersPage[followersPage.length - 1]
        }
      }

      // Requête 3 : mes propres publications (toutes visibilités)
      const myConstraints: any[] = [
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ]

      const mySnap = await getDocs(
        query(collection(db, 'posts'), ...myConstraints),
      )

      // Fusion + dédoublonnage + tri
      const allDocs = new Map<string, QueryDocumentSnapshot>()

      for (const d of publicSnap.docs) allDocs.set(d.id, d)
      for (const d of followersPage) allDocs.set(d.id, d)
      for (const d of mySnap.docs) allDocs.set(d.id, d)

      const page = Array.from(allDocs.values())
        .map(mapPost)
        .filter((post) => !blockedIds.has(post.userId))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, PAGE_SIZE)

      setPosts((current) => {
        if (reset) return page

        const ids = new Set(current.map((p) => p.id))
        return [
          ...current,
          ...page.filter((p) => !ids.has(p.id)),
        ]
      })

      setHasMore(publicSnap.docs.length === PAGE_SIZE)
    } catch (error) {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        { context: 'useNewsFeed.fetchPage' },
      )
    } finally {
      requestRunningRef.current = false
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [hasMore, posts.length, uid, followingIds])

  useEffect(() => {
    fetchPage(true)
  }, [])

  const refresh = useCallback(async () => {
    lastPublicRef.current = null
    lastFollowingRef.current = null
    setHasMore(true)
    await fetchPage(true)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchPage(false)
    }
  }, [fetchPage, loadingMore, hasMore])

  const toggleLike = useCallback(async (postId: string) => {
    if (!uid) return

    const previous = posts.find((post) => post.id === postId)
    if (!previous) return

    const wasLiked = previous.likedBy.includes(uid)

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              likes: Math.max(0, post.likes + (wasLiked ? -1 : 1)),
              likedBy: wasLiked
                ? post.likedBy.filter((id) => id !== uid)
                : [...post.likedBy, uid],
            }
          : post,
      ),
    )

    try {
      await runTransaction(db, async (transaction) => {
        const postRef = doc(db, 'posts', postId)
        const snapshot = await transaction.get(postRef)

        if (!snapshot.exists()) {
          throw new Error('Publication introuvable')
        }

        const data = snapshot.data()
        const likedBy: string[] = Array.isArray(data.likedBy)
          ? data.likedBy
          : []
        const currentlyLiked = likedBy.includes(uid)

        transaction.update(postRef, {
          likedBy: currentlyLiked
            ? arrayRemove(uid)
            : arrayUnion(uid),
          likes: increment(currentlyLiked ? -1 : 1),
        })
      })

      if (!wasLiked) {
        notifyPostOwner({
          postOwnerId: previous.userId,
          postId,
          type: 'post_like',
        })
      }
    } catch (error) {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? previous : post,
        ),
      )

      captureException(
        error instanceof Error
          ? error
          : new Error(String(error)),
        { context: 'useNewsFeed.toggleLike', postId },
      )
    }
  }, [posts, uid])

  const toggleSave = useCallback(async (postId: string) => {
    if (!uid) return

    const previous = posts.find((post) => post.id === postId)
    if (!previous) return

    const wasSaved = previous.savedBy.includes(uid)

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              saves: Math.max(0, post.saves + (wasSaved ? -1 : 1)),
              savedBy: wasSaved
                ? post.savedBy.filter((id) => id !== uid)
                : [...post.savedBy, uid],
            }
          : post,
      ),
    )

    try {
      await runTransaction(db, async (transaction) => {
        const postRef = doc(db, 'posts', postId)
        const snapshot = await transaction.get(postRef)
        if (!snapshot.exists()) return

        const data = snapshot.data()
        const savedBy: string[] = Array.isArray(data.savedBy)
          ? data.savedBy
          : []
        const saved = savedBy.includes(uid)

        transaction.update(postRef, {
          savedBy: saved
            ? arrayRemove(uid)
            : arrayUnion(uid),
          saves: increment(saved ? -1 : 1),
        })
      })
    } catch (error) {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? previous : post,
        ),
      )
    }
  }, [posts, uid])

  const registerShare = useCallback(async (postId: string) => {
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, shares: post.shares + 1 }
          : post,
      ),
    )

    try {
      await runTransaction(db, async (transaction) => {
        const postRef = doc(db, 'posts', postId)
        const snapshot = await transaction.get(postRef)
        if (!snapshot.exists()) return

        transaction.update(postRef, {
          shares: increment(1),
        })
      })
    } catch (error) {
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, shares: Math.max(0, post.shares - 1) }
            : post,
        ),
      )
    }
  }, [])

  const deletePost = useCallback(async (postId: string) => {
    if (!uid) return false

    const existing = posts.find((post) => post.id === postId)

    if (!existing || existing.userId !== uid) {
      return false
    }

    setPosts((current) =>
      current.filter((post) => post.id !== postId),
    )

    try {
      await deleteDoc(doc(db, 'posts', postId))

      await updateDoc(doc(db, 'users', uid), {
        postsCount: increment(-1),
      }).catch(() => {})

      return true
    } catch (error) {
      setPosts((current) => {
        if (current.some((post) => post.id === existing.id)) {
          return current
        }

        return [existing, ...current].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        )
      })

      return false
    }
  }, [posts, uid])

  const removePostsFromUser = useCallback((userId: string) => {
    setPosts((current) =>
      current.filter((post) => post.userId !== userId),
    )
  }, [])

  return {
    posts,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    refresh,
    loadMore,
    toggleLike,
    toggleSave,
    registerShare,
    deletePost,
    removePostsFromUser,
  }
}
