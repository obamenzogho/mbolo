import { useState, useCallback, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

interface FollowState {
  isFollowing: boolean
  isRequested: boolean
}

const cache = new Map<string, { state: FollowState; timestamp: number }>()
const CACHE_TTL = 60000

export function useFollowFast(targetUserId: string): FollowState {
  const [state, setState] = useState<FollowState>(() => {
    const cached = cache.get(targetUserId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.state
    }
    return { isFollowing: false, isRequested: false }
  })

  useEffect(() => {
    if (!targetUserId) return

    const cached = cache.get(targetUserId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setState(cached.state)
      return
    }

    const fetchState = async () => {
      try {
        const currentUid = auth.currentUser?.uid
        if (!currentUid) return

        const snap = await getDoc(doc(db, 'users', targetUserId))
        if (!snap.exists()) return

        const data = snap.data()
        const newState: FollowState = {
          isFollowing: data.followers?.includes(currentUid) ?? false,
          isRequested: data.pendingFollowers?.includes(currentUid) ?? false,
        }

        cache.set(targetUserId, { state: newState, timestamp: Date.now() })
        setState(newState)
      } catch {}
    }

    fetchState()
  }, [targetUserId])

  return state
}
