import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  collection, query, where, orderBy, limit, getDocs, startAfter,
  QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { withFirestoreRetry } from '@/lib/firestoreRetry'
import { captureException } from '@/lib/sentry'
import type { ProfileTab, Video as VideoType } from '@/types'

const PAGE_SIZE = 30

interface UseProfileTabsOptions {
  userId: string
  tabs?: ProfileTab[]
}

export function useProfileTabs({ userId, tabs: allowedTabs }: UseProfileTabsOptions) {
  const allTabs = allowedTabs ?? ['grid', 'reels', 'saved', 'liked']
  const [activeTab, setActiveTab] = useState<ProfileTab>(allTabs[0])

  const [ownVideos, setOwnVideos] = useState<VideoType[]>([])
  const [savedVideos, setSavedVideos] = useState<VideoType[]>([])
  const [likedVideos, setLikedVideos] = useState<VideoType[]>([])

  const ownLastDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const savedLastDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const likedLastDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)

  const ownHasMore = useRef(true)
  const savedHasMore = useRef(true)
  const likedHasMore = useRef(true)

  const ownLoaded = useRef(false)
  const savedLoaded = useRef(false)
  const likedLoaded = useRef(false)

  const [ownLoading, setOwnLoading] = useState(false)
  const [savedLoading, setSavedLoading] = useState(false)
  const [likedLoading, setLikedLoading] = useState(false)

  const [refreshing, setRefreshing] = useState(false)

  const fetchPage = useCallback(async (tab: ProfileTab, isRefresh = false) => {
    if (tab === 'grid' || tab === 'reels') {
      if (!isRefresh && (ownLoading || (!ownHasMore.current && ownLoaded.current))) return
      setOwnLoading(true)
      try {
        const q = isRefresh || !ownLastDoc.current
          ? query(collection(db, 'videos'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
          : query(collection(db, 'videos'), where('userId', '==', userId), orderBy('createdAt', 'desc'), startAfter(ownLastDoc.current), limit(PAGE_SIZE))
        const result = await withFirestoreRetry(() => getDocs(q), { context: 'profileTabs/own' })
        if (!result.error) {
          const snap: any = result.data
          const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as VideoType))
          ownLastDoc.current = snap.docs[snap.docs.length - 1] || null
          ownHasMore.current = snap.docs.length === PAGE_SIZE
          ownLoaded.current = true
          setOwnVideos(prev => isRefresh ? docs : [...prev, ...docs])
        }
      } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'fetchOwn' }) }
      setOwnLoading(false)
      return
    }

    if (tab === 'saved') {
      if (!isRefresh && (savedLoading || (!savedHasMore.current && savedLoaded.current))) return
      setSavedLoading(true)
      try {
        const q = isRefresh || !savedLastDoc.current
          ? query(collection(db, 'videos'), where('savedBy', 'array-contains', userId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
          : query(collection(db, 'videos'), where('savedBy', 'array-contains', userId), orderBy('createdAt', 'desc'), startAfter(savedLastDoc.current), limit(PAGE_SIZE))
        const result = await withFirestoreRetry(() => getDocs(q), { context: 'profileTabs/saved' })
        if (!result.error) {
          const snap: any = result.data
          const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as VideoType))
          savedLastDoc.current = snap.docs[snap.docs.length - 1] || null
          savedHasMore.current = snap.docs.length === PAGE_SIZE
          savedLoaded.current = true
          setSavedVideos(prev => isRefresh ? docs : [...prev, ...docs])
        }
      } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'fetchSaved' }) }
      setSavedLoading(false)
      return
    }

    if (tab === 'liked') {
      if (!isRefresh && (likedLoading || (!likedHasMore.current && likedLoaded.current))) return
      setLikedLoading(true)
      try {
        const q = isRefresh || !likedLastDoc.current
          ? query(collection(db, 'videos'), where('likedBy', 'array-contains', userId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
          : query(collection(db, 'videos'), where('likedBy', 'array-contains', userId), orderBy('createdAt', 'desc'), startAfter(likedLastDoc.current), limit(PAGE_SIZE))
        const result = await withFirestoreRetry(() => getDocs(q), { context: 'profileTabs/liked' })
        if (!result.error) {
          const snap: any = result.data
          const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as VideoType))
          likedLastDoc.current = snap.docs[snap.docs.length - 1] || null
          likedHasMore.current = snap.docs.length === PAGE_SIZE
          likedLoaded.current = true
          setLikedVideos(prev => isRefresh ? docs : [...prev, ...docs])
        }
      } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'fetchLiked' }) }
      setLikedLoading(false)
    }
  }, [userId])

  useEffect(() => {
    const loaded = activeTab === 'grid' || activeTab === 'reels' ? ownLoaded.current
      : activeTab === 'saved' ? savedLoaded.current
      : likedLoaded.current
    if (!loaded) fetchPage(activeTab)
  }, [activeTab, fetchPage])

  const gridVideos = useMemo(() => ownVideos.filter(v => v.type !== 'reel'), [ownVideos])
  const reelVideos = useMemo(() => ownVideos.filter(v => v.type === 'reel'), [ownVideos])

  const currentVideos = useMemo(() => {
    if (activeTab === 'grid') return gridVideos
    if (activeTab === 'reels') return reelVideos
    if (activeTab === 'saved') return savedVideos
    if (activeTab === 'liked') return likedVideos
    return []
  }, [activeTab, gridVideos, reelVideos, savedVideos, likedVideos])

  const loading = activeTab === 'grid' || activeTab === 'reels' ? ownLoading
    : activeTab === 'saved' ? savedLoading
    : likedLoading

  const hasMore = activeTab === 'grid' || activeTab === 'reels' ? ownHasMore.current
    : activeTab === 'saved' ? savedHasMore.current
    : likedHasMore.current

  const loadMore = useCallback(async () => {
    await fetchPage(activeTab, false)
  }, [fetchPage, activeTab])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    const promises: Promise<void>[] = []
    if (ownLoaded.current) promises.push(fetchPage('grid', true))
    if (savedLoaded.current) promises.push(fetchPage('saved', true))
    if (likedLoaded.current) promises.push(fetchPage('liked', true))
    await Promise.all(promises)
    setRefreshing(false)
  }, [fetchPage])

  return {
    activeTab,
    setActiveTab,
    currentVideos,
    gridVideos,
    reelVideos,
    savedVideos,
    likedVideos,
    loading,
    refreshing,
    onRefresh,
    loadMore,
    hasMore,
  }
}
