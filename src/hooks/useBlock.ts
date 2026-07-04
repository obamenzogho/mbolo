import { useState, useCallback, useEffect } from 'react'
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'

export function useBlock(targetUserId: string) {
  const [isBlocked, setIsBlocked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!targetUserId) return
    const currentUid = auth.currentUser?.uid
    if (!currentUid) {
      setLoading(false)
      return
    }

    const checkBlock = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', currentUid))
        if (snap.exists()) {
          const blocked = snap.data()?.blocked || []
          setIsBlocked(blocked.includes(targetUserId))
        }
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useBlock-check' })
      } finally {
        setLoading(false)
      }
    }

    checkBlock()
  }, [targetUserId])

  const toggleBlock = useCallback(async () => {
    const currentUid = auth.currentUser?.uid
    if (!currentUid || !targetUserId) return

    try {
      const userRef = doc(db, 'users', currentUid)
      if (isBlocked) {
        await updateDoc(userRef, {
          blocked: arrayRemove(targetUserId),
        })
        setIsBlocked(false)
      } else {
        await updateDoc(userRef, {
          blocked: arrayUnion(targetUserId),
          followers: arrayRemove(targetUserId),
          following: arrayRemove(targetUserId),
          pendingFollowers: arrayRemove(targetUserId),
          pendingFollowings: arrayRemove(targetUserId),
        })
        setIsBlocked(true)
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useBlock-toggle' })
    }
  }, [isBlocked, targetUserId])

  return { isBlocked, loading, toggleBlock }
}
