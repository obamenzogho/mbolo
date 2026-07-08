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
  doc,
  getDoc,
  documentId,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import { auth, db } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import { generateThumbnailURL } from '../../../lib/cloudinary'
import { getSeenVideos } from '../../../lib/feed'
import { getBlockedUserIds } from '../../../lib/blockService'
import { FEED_DEBUG } from '../store/feedStore'
import { diversify } from '../services/rankVideos'
import type { Video } from '../../../types'
import type { FeedState } from '../store/feedStore'

const PAGE_SIZE = 20
const TRIGGER_OFFSET = 10
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
  const recentCreatorsRef = useRef<string[]>([])
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

      const blockedIds = await getBlockedUserIds()

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

      // ✅ FIX pagination : un SEUL curseur temporel commun à tous les batches.
      // startAfter(doc) n'a aucun sens entre requêtes parallèles indépendantes.
      const buildConstraints = (batch: string[]) => {
        const c: any[] = [
          where('userId', 'in', batch),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE),
        ]
        if (lastTimestampRef.current) c.push(where('createdAt', '<', lastTimestampRef.current))
        return c
      }

      // Vidéos POSTÉES par les gens suivis
      const authoredQueries = batches.map((batch) =>
        getDocs(query(collection(db, 'videos'), ...buildConstraints(batch)))
      )

      // ✅ REPOSTS : docs de reposts des gens suivis, dans la même fenêtre temporelle
      const repostQueries = batches.map((batch) => {
        const c: any[] = [
          where('userId', 'in', batch),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE),
        ]
        if (lastTimestampRef.current) c.push(where('createdAt', '<', lastTimestampRef.current))
        return getDocs(query(collection(db, 'reposts'), ...c))
      })

      const [authoredSnaps, repostSnaps] = await Promise.all([
        Promise.all(authoredQueries),
        Promise.all(repostQueries),
      ])
      const snapshots = authoredSnaps

      const allDocs: { doc: any; createdAt: Date }[] = []
      for (const snap of snapshots) {
        for (const d of snap.docs) {
          const data = d.data()
          if (data.corrupted) continue
          if (data.moderationStatus === 'hidden') continue
          if (seenVideosRef.current.has(d.id)) continue
          if (blockedIds.has(data.userId)) continue
          allDocs.push({ doc: d, createdAt: data.createdAt?.toDate?.() ?? new Date() })
        }
      }

      // ✅ Résout les vidéos repostées (batch-fetch par documentId, 30 max)
      const repostEntries: { videoId: string; repostedAt: Date; reposterId: string }[] = []
      for (const snap of repostSnaps) {
        for (const d of snap.docs) {
          const r = d.data()
          if (!r.postId) continue
          repostEntries.push({
            videoId: r.postId,
            repostedAt: r.createdAt?.toDate?.() ?? new Date(),
            reposterId: r.userId,
          })
        }
      }
      if (repostEntries.length > 0) {
        const ids = [...new Set(repostEntries.map((e) => e.videoId))]
        const chunks: string[][] = []
        for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
        const vSnaps = await Promise.all(
          chunks.map((chunk) =>
            getDocs(query(collection(db, 'videos'), where(documentId(), 'in', chunk)))
          )
        )
        const vMap = new Map<string, any>()
        vSnaps.forEach((s) => s.docs.forEach((d) => vMap.set(d.id, d)))
        for (const e of repostEntries) {
          const d = vMap.get(e.videoId)
          if (!d) continue
          const data = d.data()
          if (data.corrupted || data.moderationStatus === 'hidden') continue
          if (seenVideosRef.current.has(d.id)) continue
          if (blockedIds.has(data.userId)) continue
          // La date de tri = date du repost (c'est ça qui le fait remonter)
          allDocs.push({ doc: d, createdAt: e.repostedAt })
        }
      }

      if (allDocs.length === 0) {
        setHasMore(false)
        return
      }

      // ✅ Dédoublonne (une vidéo postée ET repostée = une seule entrée, la plus récente)
      const byId = new Map<string, { doc: any; createdAt: Date }>()
      for (const entry of allDocs) {
        const prev = byId.get(entry.doc.id)
        if (!prev || entry.createdAt.getTime() > prev.createdAt.getTime()) {
          byId.set(entry.doc.id, entry)
        }
      }
      const deduped = [...byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      const topDocs = deduped.slice(0, PAGE_SIZE)

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

      // ✅ Diversité par créateur : évite qu'un seul compte squatte le feed
      const diversified = diversify(videoList, 3, recentCreatorsRef.current)
      recentCreatorsRef.current = diversified.slice(-3).map((v) => v.userId)

      if (isFirstFetch.current) {
        isFirstFetch.current = false
        setVideos(diversified)
      } else {
        appendVideos(diversified)
      }

      setHasMore(deduped.length > PAGE_SIZE)
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
      }).catch((e) => {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useFollowingFeedData:init' })
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
