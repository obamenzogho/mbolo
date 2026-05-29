/* useFollowingFeedData — pagination Firestore pour le feed "Suivi".
   Rôle : query where('userId', 'in', followingList) + orderBy('createdAt', 'desc'),
   20 par page. Identique à useFeedData mais filtré sur les comptes suivis.
   Re-fetch la following list quand isActive passe de false à true
   (invalidation suite à un nouveau follow pendant la session). */

import { useEffect, useRef, useCallback } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  doc,
  getDoc,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import { auth, db } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import { generateThumbnailURL } from '../../../lib/cloudinary'
import { getSeenVideos } from '../../../lib/feed'
import { FEED_DEBUG } from '../store/feedStore'
import type { Video } from '../../../types'
import type { FeedState } from '../store/feedStore'

const PAGE_SIZE = 20
const TRIGGER_OFFSET = 5
const MIN_KEEP = 5
const MAX_EXTRA_FETCHES = 3

export function useFollowingFeedData({ store, isActive = true }: { store: StoreApi<FeedState>; isActive?: boolean }) {
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null)
  const lastTimestampRef = useRef<Date | null>(null)
  const isFirstFetch = useRef(true)
  const loadingRef = useRef(false)
  const fetchAttemptedRef = useRef(false)
  const followingRef = useRef<string[]>([])
  const prevActiveRef = useRef(isActive)
  const seenVideosRef = useRef<Set<string>>(new Set())
  const seenLoadedRef = useRef(false)
  const extraFetchesRef = useRef(0)
  const videos = useStore(store, (s) => s.videos)
  const currentIndex = useStore(store, (s) => s.currentIndex)
  const isLoadingMore = useStore(store, (s) => s.isLoadingMore)
  const hasMore = useStore(store, (s) => s.hasMore)
  const setVideos = useStore(store, (s) => s.setVideos)
  const appendVideos = useStore(store, (s) => s.appendVideos)
  const setLoadingMore = useStore(store, (s) => s.setLoadingMore)
  const setHasMore = useStore(store, (s) => s.setHasMore)

  const fetchFollowing = useCallback(async (): Promise<string[]> => {
    const uid = auth.currentUser?.uid
    if (!uid) return []
    try {
      const uSnap = await getDoc(doc(db, 'users', uid))
      if (uSnap.exists()) {
        const data = uSnap.data()
        const list: string[] = data.following || []
        followingRef.current = list
        return list
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'fetchFollowing' })
    }
    return []
  }, [])

  const fetchVideos = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    const following = followingRef.current
    if (following.length === 0) {
      setHasMore(false)
      return
    }
    loadingRef.current = true
    setLoadingMore(true)

    try {
      if (!seenLoadedRef.current) {
        const seen = await getSeenVideos()
        seenVideosRef.current = new Set(seen)
        seenLoadedRef.current = true
      }

      if (extraFetchesRef.current >= MAX_EXTRA_FETCHES) {
        loadingRef.current = false
        setLoadingMore(false)
        return
      }
      const BATCH_SIZE = 30
      const batches: string[][] = []
      for (let i = 0; i < following.length; i += BATCH_SIZE) {
        batches.push(following.slice(i, i + BATCH_SIZE))
      }

      const queries = batches.map((batch) => {
        const constraints: any[] = [
          where('userId', 'in', batch),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE),
        ]
        if (lastDocRef.current) {
          constraints.push(startAfter(lastDocRef.current))
        }
        if (lastTimestampRef.current) {
          constraints.push(where('createdAt', '<', lastTimestampRef.current))
        }
        return getDocs(query(collection(db, 'videos'), ...constraints))
      })

      const snapshots = await Promise.all(queries)

      const allDocs: { doc: any; createdAt: Date }[] = []
      for (const snap of snapshots) {
        for (const d of snap.docs) {
          const data = d.data()
          if (data.corrupted) continue
          if (seenVideosRef.current.has(d.id)) continue
          allDocs.push({ doc: d, createdAt: data.createdAt?.toDate?.() ?? new Date() })
        }
      }

      if (allDocs.length === 0) {
        setHasMore(false)
        return
      }

      allDocs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      const topDocs = allDocs.slice(0, PAGE_SIZE)

      lastDocRef.current = topDocs[topDocs.length - 1].doc as QueryDocumentSnapshot
      lastTimestampRef.current = topDocs[topDocs.length - 1].createdAt

      const videoList: Video[] = []
      for (const { doc: d } of topDocs) {
        const data = d.data()
        videoList.push({
          id: d.id,
          userId: data.userId,
          userName: data.userName ?? undefined,
          userPhotoURL: data.userPhotoURL ?? undefined,
          videoURL: data.videoURL,
          videoURL_360p: data.videoURL_360p,
          videoURL_480p: data.videoURL_480p,
          thumbnailURL: data.thumbnailURL ?? generateThumbnailURL(data.videoURL as string) ?? undefined,
          description: data.description || '',
          hashtags: data.hashtags || [],
          likes: data.likes ?? 0,
          comments: data.comments ?? 0,
          shares: data.shares ?? 0,
          reposts: data.reposts ?? 0,
          repostedBy: data.repostedBy ?? undefined,
          latestRepostedBy: data.latestRepostedBy ?? undefined,
          saves: data.saves ?? 0,
          savedBy: data.savedBy ?? undefined,
          soundId: data.soundId,
          type: data.type || 'video',
          views: data.views ?? 0,
          likedBy: data.likedBy || [],
          previewComments: data.previewComments ?? undefined,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        })
      }

      if (videoList.length < MIN_KEEP && topDocs.length >= PAGE_SIZE) {
        extraFetchesRef.current++
        loadingRef.current = false
        setLoadingMore(false)
        fetchVideos()
        return
      }

      if (isFirstFetch.current) {
        isFirstFetch.current = false
        setVideos(videoList)
      } else {
        appendVideos(videoList)
      }

      setHasMore(allDocs.length > PAGE_SIZE)
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useFollowingFeedData' })
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }, [hasMore, setVideos, appendVideos, setLoadingMore, setHasMore])

  useEffect(() => {
    if (!fetchAttemptedRef.current) {
      fetchAttemptedRef.current = true
      fetchFollowing().then((list) => {
        if (list.length === 0) {
          setVideos([])
          setHasMore(false)
          if (FEED_DEBUG) console.log('[FEED_DEBUG] FOLLOWINGFEED: empty following list')
        } else {
          fetchVideos()
        }
      })
    }
  }, [fetchVideos, fetchFollowing, setVideos, setHasMore])

  useEffect(() => {
    if (prevActiveRef.current === isActive) return
    const wasActive = prevActiveRef.current
    prevActiveRef.current = isActive

    if (!wasActive && isActive) {
      if (FEED_DEBUG) console.log('[FEED_DEBUG] FOLLOWINGFEED: active → refresh following list')
      const prevList = followingRef.current
      fetchFollowing().then((list) => {
        if (list.length === 0) return

        const hasChanged = prevList.length !== list.length
          || list.some(id => !prevList.includes(id))

        if (!hasChanged) {
          if (FEED_DEBUG) console.log('[FEED_DEBUG] FOLLOWINGFEED: following list unchanged, skip re-fetch')
          return
        }

        lastDocRef.current = null
        isFirstFetch.current = true
        setHasMore(true)
        fetchVideos()
      })
    }
  }, [isActive, fetchFollowing, fetchVideos, setHasMore])

  useEffect(() => {
    if (videos.length === 0) return
    if (!hasMore) return
    if (loadingRef.current) return

    if (currentIndex >= videos.length - TRIGGER_OFFSET) {
      if (FEED_DEBUG) console.log('[FEED_DEBUG] FOLLOWINGFEED: trigger fetch at index', currentIndex, '/', videos.length)
      fetchVideos()
    }
  }, [currentIndex, videos.length, hasMore, fetchVideos])

  const isEmpty = videos.length === 0 && !isLoadingMore && !hasMore

  const refresh = useCallback(() => {
    lastDocRef.current = null
    isFirstFetch.current = true
    fetchAttemptedRef.current = false
    seenLoadedRef.current = false
    extraFetchesRef.current = 0
    setHasMore(true)
    fetchFollowing().then((list) => {
      if (list.length === 0) {
        setVideos([])
        setHasMore(false)
      } else {
        fetchVideos()
      }
    })
  }, [fetchVideos, fetchFollowing, setVideos, setHasMore])

  return {
    videos,
    isLoadingMore,
    hasMore,
    isEmpty,
    loadMore: fetchVideos,
    refresh,
  }
}
