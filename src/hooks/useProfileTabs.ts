import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  collection, query, where, orderBy, limit, getDocs, startAfter,
  QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { withFirestoreRetry } from '@/lib/firestoreRetry'
import { captureException } from '@/lib/sentry'
import { getRepostedVideos } from '@/features/repost/services/repostService'
import type { ProfileTab, Video as VideoType } from '@/types'

const PAGE_SIZE = 30

interface UseProfileTabsOptions {
  userId: string
  tabs?: ProfileTab[]
}

export function useProfileTabs({ userId, tabs: allowedTabs }: UseProfileTabsOptions) {
  const allTabs = allowedTabs ?? ['grid', 'saved', 'liked']
  const [activeTab, setActiveTab] = useState<ProfileTab>(allTabs[0])

  const [ownVideos, setOwnVideos] = useState<VideoType[]>([])
  const [savedVideos, setSavedVideos] = useState<VideoType[]>([])
  const [likedVideos, setLikedVideos] = useState<VideoType[]>([])
  const [repostedVideos, setRepostedVideos] = useState<VideoType[]>([])
  const [taggedVideos, setTaggedVideos] = useState<VideoType[]>([])

  const ownLastDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const savedLastDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const likedLastDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const repostedLastDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)
  const taggedLastDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)

  const ownHasMore = useRef(true)
  const savedHasMore = useRef(true)
  const likedHasMore = useRef(true)
  const repostedHasMore = useRef(true)
  const taggedHasMore = useRef(true)

  const ownLoaded = useRef(false)
  const savedLoaded = useRef(false)
  const likedLoaded = useRef(false)
  const repostedLoaded = useRef(false)
  const taggedLoaded = useRef(false)

  const [ownLoading, setOwnLoading] = useState(false)
  const [savedLoading, setSavedLoading] = useState(false)
  const [likedLoading, setLikedLoading] = useState(false)
  const [repostedLoading, setRepostedLoading] = useState(false)
  const [taggedLoading, setTaggedLoading] = useState(false)

  const [refreshing, setRefreshing] = useState(false)

  const fetchPage = useCallback(async (tab: ProfileTab, isRefresh = false) => {
    if (tab === 'grid') {
      if (!isRefresh && (ownLoading || (!ownHasMore.current && ownLoaded.current))) return
      setOwnLoading(true)
      try {
        const q = isRefresh || !ownLastDoc.current
          ? query(collection(db, 'videos'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
          : query(collection(db, 'videos'), where('userId', '==', userId), orderBy('createdAt', 'desc'), startAfter(ownLastDoc.current), limit(PAGE_SIZE))
        const result = await withFirestoreRetry(() => getDocs(q), { context: 'profileTabs/own' })
        if (!result.error) {
          const snap: any = result.data
          const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as VideoType)).filter((v: any) => v.moderationStatus !== 'hidden')
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
          const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as VideoType)).filter((v: any) => v.moderationStatus !== 'hidden')
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
          const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as VideoType)).filter((v: any) => v.moderationStatus !== 'hidden')
          likedLastDoc.current = snap.docs[snap.docs.length - 1] || null
          likedHasMore.current = snap.docs.length === PAGE_SIZE
          likedLoaded.current = true
          setLikedVideos(prev => isRefresh ? docs : [...prev, ...docs])
        }
      } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'fetchLiked' }) }
      setLikedLoading(false)
      return
    }

    if (tab === 'reposted') {
      if (!isRefresh && (repostedLoading || (!repostedHasMore.current && repostedLoaded.current))) return
      setRepostedLoading(true)
      try {
        const result = await getRepostedVideos(userId, isRefresh ? null : repostedLastDoc.current)
        repostedLastDoc.current = result.lastDoc
        repostedHasMore.current = result.hasMore
        repostedLoaded.current = true
        setRepostedVideos(prev => isRefresh ? result.videos : [...prev, ...result.videos])
      } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'fetchReposted' }) }
      setRepostedLoading(false)
    }

    if (tab === 'tagged') {
      if (!isRefresh && (taggedLoading || (!taggedHasMore.current && taggedLoaded.current))) return
      setTaggedLoading(true)
      try {
        const q = isRefresh || !taggedLastDoc.current
          ? query(collection(db, 'videos'), where('taggedUsers', 'array-contains', userId), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
          : query(collection(db, 'videos'), where('taggedUsers', 'array-contains', userId), orderBy('createdAt', 'desc'), startAfter(taggedLastDoc.current), limit(PAGE_SIZE))
        const result = await withFirestoreRetry(() => getDocs(q), { context: 'profileTabs/tagged' })
        if (!result.error) {
          const snap: any = result.data
          const docs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as VideoType)).filter((v: any) => v.moderationStatus !== 'hidden')
          taggedLastDoc.current = snap.docs[snap.docs.length - 1] || null
          taggedHasMore.current = snap.docs.length === PAGE_SIZE
          taggedLoaded.current = true
          setTaggedVideos(prev => isRefresh ? docs : [...prev, ...docs])
        }
      } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'fetchTagged' }) }
      setTaggedLoading(false)
    }
  }, [userId])

  useEffect(() => {
    const loaded = activeTab === 'grid' ? ownLoaded.current
      : activeTab === 'saved' ? savedLoaded.current
      : activeTab === 'liked' ? likedLoaded.current
      : activeTab === 'reposted' ? repostedLoaded.current
      : activeTab === 'tagged' ? taggedLoaded.current
      : false
    if (!loaded) fetchPage(activeTab)
  }, [activeTab, fetchPage])

  const gridVideos = useMemo(() => ownVideos.filter(v => v.type !== 'reel'), [ownVideos])
  const reelVideos = useMemo(() => ownVideos.filter(v => v.type === 'reel'), [ownVideos])

  const currentVideos = useMemo(() => {
    if (activeTab === 'grid') return gridVideos
    if (activeTab === 'saved') return savedVideos
    if (activeTab === 'liked') return likedVideos
    if (activeTab === 'reposted') return repostedVideos
    if (activeTab === 'tagged') return taggedVideos
    return []
  }, [activeTab, gridVideos, savedVideos, likedVideos, repostedVideos, taggedVideos])

  const loading = activeTab === 'grid' ? ownLoading
    : activeTab === 'saved' ? savedLoading
    : activeTab === 'liked' ? likedLoading
    : activeTab === 'tagged' ? taggedLoading
    : repostedLoading

  const hasMore = activeTab === 'grid' ? ownHasMore.current
    : activeTab === 'saved' ? savedHasMore.current
    : activeTab === 'liked' ? likedHasMore.current
    : activeTab === 'tagged' ? taggedHasMore.current
    : repostedHasMore.current

  const loadMore = useCallback(async () => {
    await fetchPage(activeTab, false)
  }, [fetchPage, activeTab])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    const promises: Promise<void>[] = []
    if (ownLoaded.current) promises.push(fetchPage('grid', true))
    if (savedLoaded.current) promises.push(fetchPage('saved', true))
    if (likedLoaded.current) promises.push(fetchPage('liked', true))
    if (repostedLoaded.current) promises.push(fetchPage('reposted', true))
    if (taggedLoaded.current) promises.push(fetchPage('tagged', true))
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
    repostedVideos,
    taggedVideos,
    loading,
    refreshing,
    onRefresh,
    loadMore,
    hasMore,
  }
}
