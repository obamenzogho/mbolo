import { useState, useEffect, useCallback, useRef } from 'react'
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'
import {
  fetchPourtoiVideos, fetchSuiviVideos,
  loadUserMeta,
  batchFetchUsers, fetchVideoCounts, clearUserCache,
  clearSeenVideos,
} from '../services/feedService'
import type { Video as VideoType } from '../../../types'

export type FeedMode = 'pourtoi' | 'suivi'

type FeedError = { message: string; cause?: unknown }

interface UserInfo {
  nom: string
  photoURL?: string
}

function isIndexError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'failed-precondition'
  )
}

export function useVideoFeed(batchSize = 10, feedMode: FeedMode = 'pourtoi') {
  const [videos, setVideos] = useState<VideoType[]>([])
  const [userMap, setUserMap] = useState<Map<string, UserInfo>>(new Map())
  const [videoCounts, setVideoCounts] = useState<Map<string, {
    liked: boolean; saved: boolean; likes: number; saves: number; comments: number; shares: number
  }>>(new Map())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<FeedError | null>(null)
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'refreshing' | 'done' | 'empty'>('idle')
  const [contentReady, setContentReady] = useState(false)

  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const followingRef = useRef<string[]>([])
  const seenRef = useRef<string[]>([])
  const lastFollowingIdx = useRef(0)
  const loadingRef = useRef(false)
  const initialLoadDone = useRef(false)
  const positionsRef = useRef<Record<string, number>>({})

  const updatePosition = useCallback((videoId: string, position: number) => {
    positionsRef.current[videoId] = position
  }, [])

  const loadMoreTriggerRef = useRef<() => Promise<void> | undefined>(undefined)
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoading(true)
    setError(null)

    try {
      if (feedMode === 'suivi') {
        const { items, nextIdx, hasMore: more } = await fetchSuiviVideos(
          followingRef.current, lastFollowingIdx.current, batchSize, seenRef.current,
        )
        lastFollowingIdx.current = nextIdx
        setHasMore(more)
        setVideos(prev => {
          if (prev.length === 0) return items
          const existing = new Set(prev.map(v => v.id))
          return [...prev, ...items.filter(v => !existing.has(v.id))]
        })
      } else {
        const { items, nextDoc, hasMore: more } = await fetchPourtoiVideos(
          lastDocRef.current, batchSize, seenRef.current,
        )
        lastDocRef.current = nextDoc
        setHasMore(more)
        setVideos(prev => {
          if (prev.length === 0) return items
          const existing = new Set(prev.map(v => v.id))
          return [...prev, ...items.filter(v => !existing.has(v.id))]
        })
      }
    } catch (cause) {
      const message = isIndexError(cause)
        ? 'Index Firestore manquant. Les données seront disponibles une fois l\'index créé.'
        : 'Impossible de charger le feed pour le moment.'
      setError({ message, cause })
      setHasMore(false)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [feedMode, setVideos, setLoading, setHasMore, setError, hasMore])

  loadMoreTriggerRef.current = loadMore

  const loadMeta = useCallback(async () => {
    const { seen, following } = await loadUserMeta()
    seenRef.current = seen
    followingRef.current = following
  }, [])

  const refreshCacheAndMeta = useCallback(async () => {
    clearUserCache()
    await loadMeta()
  }, [loadMeta])

  const metaLoaded = useRef(false)

  useEffect(() => {
    loadMeta().then(() => {
      metaLoaded.current = true
      if (!initialLoadDone.current) {
        initialLoadDone.current = true
        loadMore()
      }
    })
  }, [loadMeta, loadMore])

  const refreshUserMap = useCallback(async (videosToFetch: VideoType[]) => {
    const userIds = [...new Set(videosToFetch.map(v => v.userId))]
    if (userIds.length === 0) return
    const map = await batchFetchUsers(userIds)
    setUserMap(prev => {
      const merged = new Map(prev)
      map.forEach((v, k) => merged.set(k, v))
      return merged
    })
  }, [])

  const refreshCounts = useCallback(async (videoId: string) => {
    const counts = await fetchVideoCounts(videoId)
    setVideoCounts(prev => {
      const next = new Map(prev)
      next.set(videoId, counts)
      return next
    })
  }, [])

  useEffect(() => {
    if (currentIndex < 0 || currentIndex >= videos.length) return
    const video = videos[currentIndex]
    if (!video || videoCounts.has(video.id)) return
    refreshCounts(video.id)
  }, [currentIndex, videos, videoCounts, refreshCounts])

  useEffect(() => {
    if (videos.length === 0) return
    refreshUserMap(videos)
  }, [videos, refreshUserMap])

  const refresh = useCallback(async () => {
    setRefreshStatus('refreshing')
    loadingRef.current = true
    lastDocRef.current = null
    lastFollowingIdx.current = 0

    try {
      await refreshCacheAndMeta()

      let newVideos: VideoType[] = []

      if (feedMode === 'suivi') {
        const { items, nextIdx, hasMore: more } = await fetchSuiviVideos(
          followingRef.current, 0, batchSize, seenRef.current,
        )
        if (items.length > 0) {
          lastFollowingIdx.current = nextIdx
        }
        newVideos = items
        setHasMore(more)
      } else {
        const { items, nextDoc, hasMore: more } = await fetchPourtoiVideos(
          null, batchSize, seenRef.current,
        )
        lastDocRef.current = nextDoc
        newVideos = items
        setHasMore(more)
      }

      if (newVideos.length > 0) {
        setVideos(newVideos)
        setCurrentIndex(0)
        setContentReady(true)
        setRefreshStatus('done')
      } else {
        setRefreshStatus('empty')
      }
    } catch (cause) {
      const message = isIndexError(cause)
        ? 'Index Firestore manquant. Les données seront disponibles une fois l\'index créé.'
        : 'Impossible de rafraichir le feed.'
      setError({ message, cause })
      setRefreshStatus('done')
    } finally {
      loadingRef.current = false
      setTimeout(() => setRefreshStatus('idle'), 1500)
    }
  }, [feedMode, batchSize, refreshCacheAndMeta])

  const clearSeenAndRefresh = useCallback(async () => {
    await clearSeenVideos()
    seenRef.current = []
    lastDocRef.current = null
    lastFollowingIdx.current = 0
    initialLoadDone.current = false
    setVideos([])
    setCurrentIndex(0)
    setContentReady(false)
    setRefreshStatus('refreshing')
    await refreshCacheAndMeta()
    metaLoaded.current = false
    loadMeta().then(() => {
      metaLoaded.current = true
      if (!initialLoadDone.current) {
        initialLoadDone.current = true
        loadMore()
      }
    })
  }, [loadMeta, loadMore, refreshCacheAndMeta])

  useEffect(() => {
    if (videos.length > 0 && currentIndex >= videos.length - 3 && hasMore && !loadingRef.current && metaLoaded.current) {
      loadMore()
    }
  }, [currentIndex, videos.length, hasMore, loadMore])

  useEffect(() => {
    if (videos.length > 0 && !contentReady) {
      const timer = setTimeout(() => setContentReady(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [videos, contentReady])

  return {
    videos,
    userMap,
    videoCounts,
    currentIndex,
    setCurrentIndex,
    loadMore,
    refresh,
    clearSeenAndRefresh,
    loading,
    refreshStatus,
    updatePosition,
    hasMore,
    error,
    contentReady,
    setContentReady,
  }
}
