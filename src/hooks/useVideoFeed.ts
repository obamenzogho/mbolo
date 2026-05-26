import { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  where,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { withFirestoreRetry } from '../lib/firestoreRetry'
import { getIndexErrorMessage } from '../components/ui/QueryErrorMessage'
import { getSeenVideos } from '../lib/feed'
import { scoreVideo } from '../lib/scoring'
import type { Video as VideoType } from '../types'

export type FeedMode = 'pourtoi' | 'suivi'

type FeedError = {
  message: string
  cause?: unknown
}

const FOLLOWING_QUERY_LIMIT = 10

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function isValidVideo(video: Partial<VideoType>): video is VideoType {
  return Boolean(video.id && video.userId && video.videoURL)
}

function isIndexError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'failed-precondition'
  )
}

function sortByCreatedAtDesc(a: VideoType, b: VideoType) {
  const aValue = (a.createdAt as any)?.seconds ?? (a.createdAt ? new Date(a.createdAt as any).getTime() / 1000 : 0)
  const bValue = (b.createdAt as any)?.seconds ?? (b.createdAt ? new Date(b.createdAt as any).getTime() / 1000 : 0)
  return bValue - aValue
}

function toVideo(docSnap: QueryDocumentSnapshot<DocumentData>): VideoType | null {
  const video = { id: docSnap.id, ...docSnap.data() } as VideoType
  return isValidVideo(video) ? video : null
}

export function useVideoFeed(batchSize = 10, feedMode: FeedMode = 'pourtoi') {
  const [videos, setVideos] = useState<VideoType[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<FeedError | null>(null)
  const [commentsCache, setCommentsCache] = useState<Record<string, number>>({})
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [seenVideos, setSeenVideos] = useState<string[]>([])
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'refreshing' | 'done' | 'empty'>('idle')
  const [transitioning, setTransitioning] = useState(false)
  const [savedPositions, setSavedPositions] = useState<Record<string, number>>({})

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const loadingRef = useRef(false)
  const initialLoadDone = useRef(false)
  const lastFollowingIdx = useRef(0)
  const replaceNext = useRef(false)
  const videosRef = useRef<VideoType[]>([])
  videosRef.current = videos
  const currentIndexRef = useRef(0)
  currentIndexRef.current = currentIndex
  const prevFeedMode = useRef(feedMode)
  const modeCache = useRef<Record<string, {
    videos: VideoType[]
    currentIndex: number
    lastDoc: QueryDocumentSnapshot<DocumentData> | null
    lastFollowingIdx: number
    positions: Record<string, number>
  }>>({})
  const positionsRef = useRef<Record<string, number>>({})

  const updatePosition = useCallback((videoId: string, position: number) => {
    positionsRef.current[videoId] = position
  }, [])

  const loadSeenVideos = useCallback(async () => {
    const ids = await getSeenVideos()
    setSeenVideos(ids)
    return ids
  }, [])

  const loadFollowing = useCallback(async () => {
    const user = auth.currentUser
    if (!user) {
      setFollowingIds([])
      return []
    }

    try {
      const snap = await getDoc(doc(db, 'users', user.uid))
      const ids = snap.exists() ? snap.data().following || [] : []
      setFollowingIds(ids)
      return ids
    } catch (cause) {
      setFollowingIds([])
      setError({ message: 'Impossible de charger tes abonnements.', cause })
      return []
    }
  }, [])

  useEffect(() => {
    loadFollowing()
    loadSeenVideos()
  }, [loadFollowing, loadSeenVideos])

  const resetFeed = useCallback(() => {
    lastDocRef.current = null
    initialLoadDone.current = false
    loadingRef.current = false
    lastFollowingIdx.current = 0
    replaceNext.current = true
    setCurrentIndex(0)
    setHasMore(true)
    setError(null)
    setCommentsCache({})
  }, [])

  const filterSeen = useCallback((items: VideoType[], seen?: string[]) => {
    const seenIds = seen ?? seenVideos
    if (seenIds.length === 0) return items
    return items.filter(v => !seenIds.includes(v.id))
  }, [seenVideos])

  const loadFollowingVideos = useCallback(async (idsOverride?: string[]) => {
    const idsToLoad = idsOverride ?? followingIds
    if (idsToLoad.length === 0) {
      setHasMore(false)
      if (replaceNext.current) {
        replaceNext.current = false
        setVideos([])
      }
      return
    }

    const startIdx = lastFollowingIdx.current
    const batchIds = idsToLoad.slice(startIdx, startIdx + FOLLOWING_QUERY_LIMIT)
    lastFollowingIdx.current = startIdx + FOLLOWING_QUERY_LIMIT

    if (batchIds.length === 0) {
      setHasMore(false)
      if (replaceNext.current) {
        replaceNext.current = false
        setVideos([])
      }
      return
    }

    const queries = chunk(batchIds, FOLLOWING_QUERY_LIMIT).map((ids) => (
      getDocs(query(
        collection(db, 'videos'),
        where('userId', 'in', ids),
        orderBy('createdAt', 'desc'),
        limit(batchSize),
      ))
    ))

    const qResult = await withFirestoreRetry(
      () => Promise.all(queries),
      { context: 'feed/loadFollowingVideos' },
    )

    if (qResult.error) {
      throw qResult.error
    }

    const snapshots = qResult.data!
    const items = snapshots
      .flatMap((snapshot: { docs: QueryDocumentSnapshot<DocumentData>[] }) => snapshot.docs)
      .map(toVideo)
      .filter((video: VideoType | null): video is VideoType => Boolean(video))
      .sort(sortByCreatedAtDesc)
      .slice(0, batchSize)

    const unseen = filterSeen(items)

    setVideos((prev) => {
      if (replaceNext.current) {
        replaceNext.current = false
        return unseen
      }
      const existing = new Set(prev.map(v => v.id))
      return [...prev, ...unseen.filter(v => !existing.has(v.id))]
    })

    if (lastFollowingIdx.current >= idsToLoad.length || items.length < batchSize) {
      setHasMore(false)
    }
  }, [batchSize, followingIds, filterSeen])

  const loadForYouVideos = useCallback(async () => {
    const FETCH_COUNT = 30

    const feedQuery = lastDocRef.current
      ? query(
        collection(db, 'videos'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(FETCH_COUNT),
      )
      : query(
        collection(db, 'videos'),
        orderBy('createdAt', 'desc'),
        limit(FETCH_COUNT),
      )

    const snapshot = await getDocs(feedQuery)
    const items = snapshot.docs
      .map(toVideo)
      .filter((video: VideoType | null): video is VideoType => Boolean(video))

    if (snapshot.empty || items.length === 0) {
      setHasMore(false)
      if (replaceNext.current) {
        replaceNext.current = false
        setVideos([])
      }
      return
    }

    lastDocRef.current = snapshot.docs[snapshot.docs.length - 1]

    const unseen = filterSeen(items)
    const scored = unseen
      .map(v => ({ ...v, _score: scoreVideo(v) }))
      .sort((a, b) => (b as any)._score - (a as any)._score)
      .slice(0, batchSize)

    setVideos((prev) => {
      if (replaceNext.current) {
        replaceNext.current = false
        return scored
      }
      const existing = new Set(prev.map(v => v.id))
      return [...prev, ...scored.filter(v => !existing.has(v.id))]
    })
    if (items.length < FETCH_COUNT) setHasMore(false)
  }, [batchSize, filterSeen])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoading(true)
    setError(null)

    try {
      if (feedMode === 'suivi') {
        await loadFollowingVideos()
      } else {
        await loadForYouVideos()
      }
    } catch (cause) {
      const message = isIndexError(cause)
        ? getIndexErrorMessage('failed-precondition')
        : 'Impossible de charger le feed pour le moment.'
      setError({ message, cause })
      setHasMore(false)
    } finally {
      setLoading(false)
      loadingRef.current = false
      setTransitioning(false)
    }
  }, [feedMode, hasMore, loadFollowingVideos, loadForYouVideos])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setRefreshStatus('refreshing')
    loadingRef.current = true
    lastDocRef.current = null
    lastFollowingIdx.current = 0

    try {
      const ids = await loadSeenVideos()
      const following = await loadFollowing()
      let newVideos: VideoType[] = []

      if (feedMode === 'suivi') {
        if (following.length > 0) {
          const batchIds = following.slice(0, FOLLOWING_QUERY_LIMIT)
          lastFollowingIdx.current = batchIds.length
          const queries = chunk(batchIds, FOLLOWING_QUERY_LIMIT).map((ids) => (
            getDocs(query(
              collection(db, 'videos'),
              where('userId', 'in', ids),
              orderBy('createdAt', 'desc'),
              limit(batchSize),
            ))
          ))
          const qResult = await withFirestoreRetry(
            () => Promise.all(queries),
            { context: 'feed/refresh/suivi' },
          )
          if (qResult.error) {
            throw qResult.error
          }
          const snapshots = qResult.data!
          newVideos = snapshots
            .flatMap((snapshot) => snapshot.docs)
            .map(toVideo)
            .filter((video): video is VideoType => Boolean(video))
            .sort(sortByCreatedAtDesc)
            .slice(0, batchSize)
        }
      } else {
        const FETCH_COUNT = 30
        const feedQuery = query(
          collection(db, 'videos'),
          orderBy('createdAt', 'desc'),
          limit(FETCH_COUNT),
        )
        const snapshot = await getDocs(feedQuery)
        const items = snapshot.docs
          .map(toVideo)
          .filter((video: VideoType | null): video is VideoType => Boolean(video))

        if (!snapshot.empty) {
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1]
        }

        const unseen = filterSeen(items)
        newVideos = unseen
          .map(v => ({ ...v, _score: scoreVideo(v) }))
          .sort((a, b) => (b as any)._score - (a as any)._score)
          .slice(0, batchSize)
      }

      const unseen = filterSeen(newVideos as VideoType[], ids)
      const fresh = unseen.length > 0 ? unseen : []

      if (fresh.length > 0) {
        setVideos(fresh)
        setCurrentIndex(0)
        setHasMore(true)
        setRefreshStatus('done')
        setTimeout(() => setRefreshStatus('idle'), 1500)
      } else {
        setRefreshStatus('empty')
        setTimeout(() => setRefreshStatus('idle'), 1500)
      }
    } catch (cause) {
      const message = isIndexError(cause)
        ? getIndexErrorMessage('failed-precondition')
        : 'Impossible de rafraichir le feed.'
      setError({ message, cause })
      setRefreshStatus('done')
      setTimeout(() => setRefreshStatus('idle'), 1000)
    } finally {
      loadingRef.current = false
      setRefreshing(false)
    }
  }, [feedMode, batchSize, loadSeenVideos, loadFollowing, filterSeen])

  useEffect(() => {
    const prev = prevFeedMode.current
    prevFeedMode.current = feedMode

    if (videosRef.current.length > 0) {
      modeCache.current[prev] = {
        videos: videosRef.current,
        currentIndex: currentIndexRef.current,
        lastDoc: lastDocRef.current,
        lastFollowingIdx: lastFollowingIdx.current,
        positions: { ...positionsRef.current },
      }
    } else {
      delete modeCache.current[prev]
    }

    const cached = modeCache.current[feedMode]
    if (cached) {
      setVideos(cached.videos)
      setCurrentIndex(cached.currentIndex)
      setSavedPositions(cached.positions || {})
      lastDocRef.current = cached.lastDoc
      lastFollowingIdx.current = cached.lastFollowingIdx
      setTransitioning(false)
    } else {
      setSavedPositions({})
      resetFeed()
      setTransitioning(true)
    }
  }, [feedMode, resetFeed])

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      loadMore()
    }
  }, [loadMore])

  useEffect(() => {
    if (
      videos.length > 0
      && currentIndex >= videos.length - 3
      && hasMore
      && !loadingRef.current
    ) {
      loadMore()
    }
  }, [currentIndex, videos.length, hasMore, loadMore])

  useEffect(() => {
    const preloadIndices = [currentIndex + 1, currentIndex + 2]
    for (const idx of preloadIndices) {
      const video = videos[idx]
      if (!video || commentsCache[video.id] !== undefined) continue
      getDoc(doc(db, 'videos', video.id)).then((snap: { exists: () => boolean; data: () => any }) => {
        if (snap.exists()) {
          const data = snap.data()
          setCommentsCache(prev => ({ ...prev, [video.id]: data.comments || 0 }))
        }
      }).catch(() => {})
    }
  }, [currentIndex, videos, commentsCache])

  return {
    videos,
    currentIndex,
    setCurrentIndex,
    loadMore,
    refresh,
    loading,
    refreshing,
    refreshStatus,
    transitioning,
    savedPositions,
    updatePosition,
    hasMore,
    error,
    commentsCache,
    seenVideos,
  }
}