import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { NewsPost } from '../types'

const PAGE_SIZE = 20

function toDate(value: any): Date {
  if (!value) return new Date()
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  return new Date(value)
}

export function useUserPosts(userId: string | null) {
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const lastRef = useRef<QueryDocumentSnapshot | null>(null)

  const fetchPosts = useCallback(async (reset = false) => {
    if (!userId) return
    if (!reset && !hasMore) return

    setLoading(true)

    try {
      const constraints: any[] = [
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ]

      if (!reset && lastRef.current) {
        constraints.push(startAfter(lastRef.current))
      }

      const snap = await getDocs(
        query(collection(db, 'posts'), ...constraints),
      )

      lastRef.current = snap.docs[snap.docs.length - 1] ?? null

      const page: NewsPost[] = snap.docs.map((d: QueryDocumentSnapshot) => {
        const data = d.data()
        return {
          id: d.id,
          userId: data.userId,
          userName: data.userName || 'Utilisateur',
          userPhotoURL: data.userPhotoURL || undefined,
          text: data.text || '',
          format: data.format || 'text',
          media: Array.isArray(data.media) ? data.media : [],
          visibility: data.visibility || 'public',
          commentsEnabled: data.commentsEnabled !== false,
          likes: data.likes ?? 0,
          likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
          comments: data.comments ?? 0,
          shares: data.shares ?? 0,
          saves: data.saves ?? 0,
          savedBy: Array.isArray(data.savedBy) ? data.savedBy : [],
          createdAt: toDate(data.createdAt),
        }
      })

      setPosts((current) => reset ? page : [...current, ...page])
      setHasMore(snap.docs.length === PAGE_SIZE)
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [userId, hasMore])

  useEffect(() => {
    if (userId) {
      lastRef.current = null
      setHasMore(true)
      fetchPosts(true)
    }
  }, [userId])

  return { posts, loading, hasMore, loadMore: () => fetchPosts(false) }
}
