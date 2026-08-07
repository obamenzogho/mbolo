import { useState, useEffect, useCallback } from 'react'
import {
  collection, doc, updateDoc, deleteDoc, getDocs, getDoc,
  query, where, runTransaction,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'

export interface Story {
  id: string
  userId: string
  username: string
  avatarUrl: string
  mediaUrl: string
  mediaType: 'image' | 'video' | 'text'
  text?: string
  backgroundColor?: string
  backgroundGradient?: string[]
  caption?: string
  textOverlay?: string
  textPosition?: { x: number; y: number }
  createdAt: Date
  expiresAt: Date
  savedToHighlight: boolean
  views: number
  viewedBy: string[]
  moderationStatus?: 'visible' | 'hidden'
}

function toDate(value: any): Date {
  if (value?.toDate) return value.toDate()
  if (value?.seconds) return new Date(value.seconds * 1000)
  return new Date(value)
}

export function useStories() {
  const user = auth.currentUser
  const [myStories, setMyStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(false)

  const deleteStory = useCallback(async (storyId: string) => {
    try {
      await deleteDoc(doc(db, 'stories', storyId))
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteStory' })
    }
  }, [])

  const getUserStories = useCallback(async (userId: string): Promise<Story[]> => {
    try {
      const q = query(
        collection(db, 'stories'),
        where('userId', '==', userId),
      )
      const snap = await getDocs(q)
      const now = new Date()
      return snap.docs
        .map((d: any) => ({ id: d.id, ...d.data() } as Story))
        .filter((s: Story) => s.expiresAt && toDate(s.expiresAt) > now)
        .sort((a: Story, b: Story) => {
          const aTime = (a.createdAt as any)?.seconds || 0
          const bTime = (b.createdAt as any)?.seconds || 0
          return bTime - aTime
        })
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getUserStories' })
      return []
    }
  }, [])

  const getMyStories = useCallback(async (): Promise<Story[]> => {
    if (!user) return []
    return getUserStories(user.uid)
  }, [user, getUserStories])

  const getStoryViewers = useCallback(async (viewerIds: string[]) => {
    const uniqueIds = [...new Set(viewerIds.filter(Boolean))]

    const results = await Promise.allSettled(
      uniqueIds.map(async (uid) => {
        const snap = await getDoc(doc(db, 'users', uid))
        if (!snap.exists()) return null

        const data = snap.data()
        return {
          uid,
          displayName: data.nom || data.pseudo || data.displayName || 'Utilisateur',
          photoURL: data.photoURL || '',
        }
      }),
    )

    return results.flatMap((result) =>
      result.status === 'fulfilled' && result.value ? [result.value] : [],
    )
  }, [])

  const markAsViewed = useCallback(async (storyId: string, viewerId: string) => {
    if (!storyId || !viewerId) return

    try {
      const storyRef = doc(db, 'stories', storyId)

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(storyRef)
        if (!snap.exists()) return

        const data = snap.data()
        if (data.userId === viewerId) return

        const viewedBy: string[] = Array.isArray(data.viewedBy) ? data.viewedBy : []
        if (viewedBy.includes(viewerId)) return

        transaction.update(storyRef, {
          viewedBy: [...viewedBy, viewerId],
          views: viewedBy.length + 1,
        })
      })
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'markAsViewed', storyId })
    }
  }, [])

  const cleanExpiredStories = useCallback(async () => {
    if (!user) return
    try {
      const q = query(
        collection(db, 'stories'),
        where('userId', '==', user.uid),
      )
      const snap = await getDocs(q)
      const now = new Date()
      for (const d of snap.docs as any[]) {
        const data = d.data() as Story
        if (toDate(data.expiresAt) < now && !data.savedToHighlight) {
          await deleteDoc(doc(db, 'stories', d.id))
        }
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'cleanExpiredStories' })
    }
  }, [user])

  useEffect(() => {
    if (user) {
      setLoading(true)
      getMyStories().then(stories => {
        setMyStories(stories)
        setLoading(false)
      })
      cleanExpiredStories()
    }
  }, [user, getMyStories, cleanExpiredStories])

  return {
    myStories,
    loading,
    deleteStory,
    getMyStories,
    getUserStories,
    getStoryViewers,
    markAsViewed,
    cleanExpiredStories,
  }
}
