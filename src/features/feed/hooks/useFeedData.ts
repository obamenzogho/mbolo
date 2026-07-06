/* useFeedData — pagination Firestore du feed.
   Rôle : fetch par page de PAGE_SIZE=60, déclenché quand currentIndex >= videos.length - TRIGGER_OFFSET.
   Ranking par scoreVideo (engagement + fraîcheur + affinité + qualité).
   userName et userPhotoURL lus directement depuis le document vidéo (dénormalisation).
   Paramètre store : instance Zustand isolée (forYouFeedStore ou followingFeedStore). */

import { useEffect, useRef, useCallback } from 'react'
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import { db } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import { generateThumbnailURL } from '../../../lib/cloudinary'
import { getSeenVideos } from '../../../lib/feed'
import { getBlockedUserIds } from '../../../lib/blockService'
import { FEED_DEBUG } from '../store/feedStore'
import { rankVideos, EMPTY_TASTE, type UserTaste } from '../services/rankVideos'
import { buildUserTaste } from '../services/userTaste'
import type { Video } from '../../../types'
import type { FeedState } from '../store/feedStore'

const PAGE_SIZE = 60
const TRIGGER_OFFSET = 15
const MIN_KEEP = 5
const MAX_EXTRA_FETCHES = 3

export function useFeedData({ store }: { store: StoreApi<FeedState> }) {
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null)
  const isFirstFetch = useRef(true)
  const loadingRef = useRef(false)
  const fetchAttemptedRef = useRef(false)
  const seenVideosRef = useRef<Set<string>>(new Set())
  const seenLoadedRef = useRef(false)
  const extraFetchesRef = useRef(0)
  const tasteRef = useRef<UserTaste>(EMPTY_TASTE)
  const tasteLoadedRef = useRef(false)
  const recentCreatorsRef = useRef<string[]>([])
  const videos = useStore(store, (s) => s.videos)
  const currentIndex = useStore(store, (s) => s.currentIndex)
  const isLoadingMore = useStore(store, (s) => s.isLoadingMore)
  const hasMore = useStore(store, (s) => s.hasMore)
  const setVideos = useStore(store, (s) => s.setVideos)
  const appendVideos = useStore(store, (s) => s.appendVideos)
  const setLoadingMore = useStore(store, (s) => s.setLoadingMore)
  const setHasMore = useStore(store, (s) => s.setHasMore)

  const fetchVideos = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    if (extraFetchesRef.current >= MAX_EXTRA_FETCHES) return
    loadingRef.current = true
    setLoadingMore(true)

    try {
      if (!seenLoadedRef.current) {
        const seen = await getSeenVideos()
        seenVideosRef.current = new Set(seen)
        seenLoadedRef.current = true
      }

      const blockedIds = await getBlockedUserIds()

      if (!tasteLoadedRef.current) {
        tasteRef.current = await buildUserTaste()
        tasteLoadedRef.current = true
      }

      const constraints = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE)]
      if (lastDocRef.current) {
        constraints.push(startAfter(lastDocRef.current))
      }
      const q = query(collection(db, 'videos'), ...constraints)
      const snap = await getDocs(q)

      if (snap.empty) {
        setHasMore(false)
        return
      }

      lastDocRef.current = snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot

      const videoList: Video[] = []

      for (const d of snap.docs) {
        const data = d.data()
        if (data.corrupted) continue
        if (data.moderationStatus === 'hidden') continue
        if (seenVideosRef.current.has(d.id)) continue
        if (blockedIds.has(data.userId)) continue
        videoList.push({
          id: d.id,
          userId: data.userId,
          userName: data.userName ?? undefined,
          userPhotoURL: data.userPhotoURL ?? undefined,
          videoURL: data.videoURL,
          videoURL_360p: data.videoURL_360p,
          videoURL_480p: data.videoURL_480p,
          thumbnailURL: (data.thumbnailURL as string | null)
            ?? generateThumbnailURL(data.videoURL as string)
            ?? undefined,
          description: data.description || '',
          hashtags: data.hashtags || [],
          likes: data.likes ?? 0,
          comments: data.comments ?? 0,
          shares: data.shares ?? 0,
          saves: data.saves ?? 0,
          reposts: data.reposts ?? 0,
          repostedBy: data.repostedBy ?? undefined,
          latestRepostedBy: data.latestRepostedBy ?? undefined,
          savedBy: data.savedBy ?? undefined,
          previewComments: data.previewComments ?? undefined,
          soundId: data.soundId,
          type: data.type || 'video',
          views: data.views ?? 0,
          likedBy: data.likedBy || [],
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        })
      }

      if (videoList.length < MIN_KEEP && snap.docs.length >= PAGE_SIZE) {
        extraFetchesRef.current++
        loadingRef.current = false
        setLoadingMore(false)
        fetchVideos()
        return
      }

      const ranked = rankVideos(videoList, tasteRef.current, recentCreatorsRef.current)

      if (isFirstFetch.current) {
        isFirstFetch.current = false
        setVideos(ranked)
      } else {
        appendVideos(ranked)
      }

      recentCreatorsRef.current = ranked.slice(-3).map((v) => v.userId)

      setHasMore(snap.docs.length >= PAGE_SIZE)
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useFeedData' })
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }, [hasMore, setVideos, appendVideos, setLoadingMore, setHasMore])

  useEffect(() => {
    if (!fetchAttemptedRef.current) {
      fetchAttemptedRef.current = true
      fetchVideos()
    }
  }, [fetchVideos])

  useEffect(() => {
    if (videos.length === 0) return
    if (!hasMore) return
    if (loadingRef.current) return

    if (currentIndex >= videos.length - TRIGGER_OFFSET) {
      if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDDATA: trigger fetch at index', currentIndex, '/', videos.length)
      fetchVideos()
    }
  }, [currentIndex, videos.length, hasMore, fetchVideos])

  const refresh = useCallback(() => {
    lastDocRef.current = null
    isFirstFetch.current = true
    fetchAttemptedRef.current = false
    seenLoadedRef.current = false
    tasteLoadedRef.current = false
    recentCreatorsRef.current = []
    extraFetchesRef.current = 0
    setHasMore(true)
    fetchVideos()
  }, [fetchVideos, setHasMore])

  return {
    videos,
    isLoadingMore,
    hasMore,
    isEmpty: false,
    loadMore: fetchVideos,
    refresh,
  }
}
