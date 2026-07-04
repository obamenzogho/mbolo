import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'

interface FollowState {
  isFollowing: boolean
  isRequested: boolean
  followerCount: number
  followingCount: number
}

interface FollowContextValue {
  getFollowState: (userId: string) => FollowState | null
  updateFollowState: (userId: string, state: Partial<FollowState>) => void
}

const FollowContext = createContext<FollowContextValue | null>(null)

export function FollowProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Map<string, FollowState>>(new Map())
  const listenersRef = useRef<Map<string, () => void>>(new Map())

  const getFollowState = useCallback((userId: string): FollowState | null => {
    return cache.get(userId) || null
  }, [cache])

  const updateFollowState = useCallback((userId: string, state: Partial<FollowState>) => {
    setCache((prev) => {
      const next = new Map(prev)
      const existing = next.get(userId) || { isFollowing: false, isRequested: false, followerCount: 0, followingCount: 0 }
      next.set(userId, { ...existing, ...state })
      return next
    })
  }, [])

  const subscribeToUser = useCallback((userId: string) => {
    if (listenersRef.current.has(userId)) return

    const unsub = onSnapshot(
      doc(db, 'users', userId),
      (snap: any) => {
        if (!snap.exists()) return
        const data = snap.data()
        const currentUid = auth.currentUser?.uid
        if (!currentUid) return

        const isFollowing = data.followers?.includes(currentUid) ?? false
        const isRequested = data.pendingFollowers?.includes(currentUid) ?? false
        const followerCount = data.followerCount ?? data.followers?.length ?? 0
        const followingCount = data.followingCount ?? data.following?.length ?? 0

        setCache((prev) => {
          const next = new Map(prev)
          next.set(userId, { isFollowing, isRequested, followerCount, followingCount })
          return next
        })
      },
      (error: any) => {
        captureException(error, { context: 'FollowContext subscribeToUser' })
      },
    )

    listenersRef.current.set(userId, unsub)
  }, [])

  const unsubscribeFromUser = useCallback((userId: string) => {
    const unsub = listenersRef.current.get(userId)
    if (unsub) {
      unsub()
      listenersRef.current.delete(userId)
    }
  }, [])

  useEffect(() => {
    return () => {
      listenersRef.current.forEach((unsub) => unsub())
      listenersRef.current.clear()
    }
  }, [])

  return (
    <FollowContext.Provider value={{ getFollowState, updateFollowState }}>
      {children}
    </FollowContext.Provider>
  )
}

export function useFollowCache() {
  const context = useContext(FollowContext)
  if (!context) {
    throw new Error('useFollowCache must be used within a FollowProvider')
  }
  return context
}
