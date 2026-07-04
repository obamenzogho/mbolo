import { useCallback, useRef } from 'react'
import { doc, getDoc, runTransaction, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import { createNotification } from '../lib/notifications'

const RATE_LIMIT_MS = 500

export function useFollowAction() {
  const lastActionRef = useRef<number>(0)

  const toggleFollow = useCallback(async (targetUserId: string): Promise<boolean> => {
    const now = Date.now()
    if (now - lastActionRef.current < RATE_LIMIT_MS) return false
    lastActionRef.current = now

    const currentUid = auth.currentUser?.uid
    if (!currentUid || !targetUserId) return false

    const userRef = doc(db, 'users', currentUid)
    const targetRef = doc(db, 'users', targetUserId)

    try {
      const [userSnap, targetSnap] = await Promise.all([
        getDoc(userRef),
        getDoc(targetRef),
      ])

      const userData = userSnap.data()
      const targetData = targetSnap.data()
      if (!userData || !targetData) return false

      const isCurrentlyFollowing = targetData.followers?.includes(currentUid) ?? false
      const isPrivate = targetData.privateAccount === true
      const targetFollowsMe = targetData.following?.includes(currentUid) ?? false

      if (isCurrentlyFollowing) {
        await runTransaction(db, async (transaction) => {
          const [freshUserSnap, freshTargetSnap] = await Promise.all([
            transaction.get(userRef),
            transaction.get(targetRef),
          ])
          transaction.update(userRef, {
            following: arrayRemove(targetUserId),
            followingCount: Math.max(0, (freshUserSnap.data()?.followingCount ?? 0) - 1),
          })
          transaction.update(targetRef, {
            followers: arrayRemove(currentUid),
            followerCount: Math.max(0, (freshTargetSnap.data()?.followerCount ?? 0) - 1),
          })
        })
        return false
      } else if (isPrivate) {
        await runTransaction(db, async (transaction) => {
          const [freshUserSnap, freshTargetSnap] = await Promise.all([
            transaction.get(userRef),
            transaction.get(targetRef),
          ])
          transaction.update(userRef, {
            pendingFollowings: arrayUnion(targetUserId),
          })
          transaction.update(targetRef, {
            pendingFollowers: arrayUnion(currentUid),
          })
        })
        createNotification({
          userId: targetUserId,
          type: 'follow_request',
          fromUserId: currentUid,
        })
        return false
      } else {
        const willBeFriend = targetFollowsMe
        await runTransaction(db, async (transaction) => {
          const [freshUserSnap, freshTargetSnap] = await Promise.all([
            transaction.get(userRef),
            transaction.get(targetRef),
          ])
          transaction.update(userRef, {
            following: arrayUnion(targetUserId),
            followingCount: (freshUserSnap.data()?.followingCount ?? 0) + 1,
          })
          transaction.update(targetRef, {
            followers: arrayUnion(currentUid),
            followerCount: (freshTargetSnap.data()?.followerCount ?? 0) + 1,
          })
        })
        createNotification({
          userId: targetUserId,
          type: 'follow',
          fromUserId: currentUid,
        })
        return willBeFriend
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useFollowAction' })
      return false
    }
  }, [])

  return { toggleFollow }
}
