import { useState, useCallback, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

interface FollowState {
  isFollowing: boolean
  isRequested: boolean
  /** Faux tant que l'état réel n'est pas connu : évite d'afficher « Suivre »
      sur un profil déjà suivi le temps du fetch. */
  resolved: boolean
}

const cache = new Map<string, { state: FollowState; timestamp: number }>()
const CACHE_TTL = 60000

const UNRESOLVED: FollowState = {
  isFollowing: false,
  isRequested: false,
  resolved: false,
}

export function useFollowFast(targetUserId: string): FollowState {
  const [state, setState] = useState<FollowState>(() => {
    const cached = cache.get(targetUserId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.state
    }
    return UNRESOLVED
  })

  useEffect(() => {
    if (!targetUserId) {
      // Pas de cible (ex. ses propres posts) : rien à résoudre.
      setState({ isFollowing: false, isRequested: false, resolved: true })
      return
    }

    const cached = cache.get(targetUserId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setState(cached.state)
      return
    }

    let cancelled = false
    setState(UNRESOLVED)

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
          resolved: true,
        }

        cache.set(targetUserId, { state: newState, timestamp: Date.now() })
        if (!cancelled) setState(newState)
      } catch {}
    }

    fetchState()

    return () => {
      cancelled = true
    }
  }, [targetUserId])

  return state
}
