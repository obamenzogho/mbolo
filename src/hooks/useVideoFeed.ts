import { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection, query, orderBy, limit, startAfter, getDocs, getDoc, doc,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import type { Video as VideoType } from '../types'

export const DEMO_VIDEOS: VideoType[] = [
  {
    id: 'demo-1',
    userId: 'demo',
    videoURL: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    description: 'Bienvenue sur Mbolo ! 🇬🇦',
    hashtags: ['Gabon', 'Mbolo'],
    likes: 42,
    comments: 7,
    shares: 3,
    saves: 0,
    createdAt: null as any,
  },
  {
    id: 'demo-2',
    userId: 'demo',
    videoURL: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    description: 'Le Gabon est magnifique ✨',
    hashtags: ['Gabon', 'Nature'],
    likes: 88,
    comments: 12,
    shares: 5,
    saves: 0,
    createdAt: null as any,
  },
  {
    id: 'demo-3',
    userId: 'demo',
    videoURL: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    description: 'Danse traditionnelle 🎵',
    hashtags: ['Culture', 'Danse'],
    likes: 156,
    comments: 23,
    shares: 15,
    saves: 0,
    createdAt: null as any,
  },
]

export function useVideoFeed(batchSize = 10, feedMode = 'pourtoi') {
  const [videos, setVideos] = useState<VideoType[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [commentsCache, setCommentsCache] = useState<Record<string, number>>({})
  const lastDocRef = useRef<any>(null)
  const loadingRef = useRef(false)
  const initialLoadDone = useRef(false)
  const [followingIds, setFollowingIds] = useState<string[]>([])

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return
    const loadFollowing = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (snap.exists()) {
          setFollowingIds(snap.data().following || [])
        }
      } catch {}
    }
    loadFollowing()
  }, [])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoading(true)
    try {
      if (feedMode === 'suivi' && followingIds.length === 0) {
        setVideos([])
        setHasMore(false)
        setLoading(false)
        loadingRef.current = false
        return
      }

      let q
      if (lastDocRef.current) {
        q = query(
          collection(db, 'videos'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDocRef.current),
          limit(batchSize),
        )
      } else {
        q = query(
          collection(db, 'videos'),
          orderBy('createdAt', 'desc'),
          limit(batchSize),
        )
      }
      const snapshot = await getDocs(q)
      if (snapshot.empty) {
        setHasMore(false)
        if (videos.length === 0) setVideos(DEMO_VIDEOS)
      } else {
        let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as VideoType[]

        if (feedMode === 'suivi' && followingIds.length > 0) {
          items = items.filter(v => followingIds.includes(v.userId))
        }

        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1]
        setVideos(prev => [...prev, ...items])
        if (items.length < batchSize) setHasMore(false)
      }
    } catch {
      if (videos.length === 0) setVideos(DEMO_VIDEOS)
    }
    setLoading(false)
    loadingRef.current = false
  }, [batchSize, hasMore, videos.length, feedMode, followingIds])

  useEffect(() => {
    lastDocRef.current = null
    initialLoadDone.current = false
    setVideos([])
    setHasMore(true)
    setCurrentIndex(0)
    loadingRef.current = false
  }, [feedMode])

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
      if (!video || video.id.startsWith('demo-') || commentsCache[video.id] !== undefined) continue
      getDoc(doc(db, 'videos', video.id)).then((snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setCommentsCache(prev => ({ ...prev, [video.id]: d.comments || 0 }))
        }
      }).catch(() => {})
    }
  }, [currentIndex, videos, commentsCache])

  return { videos, currentIndex, setCurrentIndex, loadMore, loading, hasMore, commentsCache }
}
