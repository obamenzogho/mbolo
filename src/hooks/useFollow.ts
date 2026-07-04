import { useState, useCallback, useEffect, useRef } from 'react'
import { doc, getDoc, runTransaction, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import { createNotification } from '../lib/notifications'

const RATE_LIMIT_MS = 500
const MAX_FOLLOWING = 10000
const MAX_FOLLOWERS = 100000

export function useFollow(targetUserId: string, initialFollowing?: boolean, initialRequested?: boolean) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing ?? false)
  const [isRequested, setIsRequested] = useState(initialRequested ?? false)
  const [isFriend, setIsFriend] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(initialFollowing === undefined && initialRequested === undefined)
  const lastActionRef = useRef<number>(0)

  useEffect(() => {
    if (!targetUserId) return
    if (initialFollowing !== undefined && initialRequested !== undefined) {
      setLoading(false)
      return
    }

    const unsub = onSnapshot(
      doc(db, 'users', targetUserId),
      (snap: any) => {
        if (!snap.exists()) return
        const data = snap.data()
        const currentUid = auth.currentUser?.uid
        const _isFollowing = data.followers?.includes(currentUid) ?? false
        setIsFollowing(_isFollowing)
        setIsRequested(data.pendingFollowers?.includes(currentUid) ?? false)
        setIsFriend(_isFollowing && (data.following?.includes(currentUid) ?? false))
        setFollowerCount(data.followerCount ?? data.followers?.length ?? 0)
        setFollowingCount(data.followingCount ?? data.following?.length ?? 0)
        setLoading(false)
      },
      (error: any) => {
        captureException(error, { context: 'useFollow onSnapshot' })
        setLoading(false)
      },
    )
    return unsub
  }, [targetUserId, initialFollowing, initialRequested])

  const toggleFollow = useCallback(async () => {
    const now = Date.now()
    if (now - lastActionRef.current < RATE_LIMIT_MS) return
    lastActionRef.current = now

    const currentUid = auth.currentUser?.uid
    if (!currentUid || !targetUserId) return

    const userRef = doc(db, 'users', currentUid)
    const targetRef = doc(db, 'users', targetUserId)

    if (isFollowing) {
      const wasFriend = isFriend
      setIsFollowing(false)
      setIsFriend(false)
      setFollowerCount((p) => Math.max(0, p - 1))
      try {
        await runTransaction(db, async (transaction) => {
          const [userSnap, targetSnap] = await Promise.all([
            transaction.get(userRef),
            transaction.get(targetRef),
          ])
          transaction.update(userRef, {
            following: arrayRemove(targetUserId),
            followingCount: Math.max(0, (userSnap.data()?.followingCount ?? 0) - 1),
          })
          transaction.update(targetRef, {
            followers: arrayRemove(currentUid),
            followerCount: Math.max(0, (targetSnap.data()?.followerCount ?? 0) - 1),
          })
        })
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'unfollow' })
        setIsFollowing(true)
        setIsFriend(wasFriend)
        setFollowerCount((p) => p + 1)
      }
    } else if (isRequested) {
      setIsRequested(false)
      try {
        await runTransaction(db, async (transaction) => {
          const [userSnap, targetSnap] = await Promise.all([
            transaction.get(userRef),
            transaction.get(targetRef),
          ])
          transaction.update(userRef, {
            pendingFollowings: arrayRemove(targetUserId),
          })
          transaction.update(targetRef, {
            pendingFollowers: arrayRemove(currentUid),
          })
        })
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'cancelFollowRequest' })
        setIsRequested(true)
      }
    } else {
      const targetSnap = await getDoc(targetRef)
      const targetData = targetSnap.exists() ? targetSnap.data() : null
      const isPrivate = targetData?.privateAccount === true
      const targetFollowsMe = targetData?.following?.includes(currentUid) ?? false

      const mySnap = await getDoc(userRef)
      const myFollowingCount = mySnap.data()?.followingCount ?? 0
      if (myFollowingCount >= MAX_FOLLOWING) return

      if (isPrivate) {
        setIsRequested(true)
        try {
          await runTransaction(db, async (transaction) => {
            const [userSnap, targetSnap2] = await Promise.all([
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
        } catch (e) {
          captureException(e instanceof Error ? e : new Error(String(e)), { context: 'followRequest' })
          setIsRequested(false)
        }
      } else {
        const willBeFriend = targetFollowsMe
        setIsFollowing(true)
        setIsFriend(willBeFriend)
        setFollowerCount((p) => p + 1)
        try {
          await runTransaction(db, async (transaction) => {
            const [userSnap, targetSnap2] = await Promise.all([
              transaction.get(userRef),
              transaction.get(targetRef),
            ])
            transaction.update(userRef, {
              following: arrayUnion(targetUserId),
              followingCount: (userSnap.data()?.followingCount ?? 0) + 1,
            })
            transaction.update(targetRef, {
              followers: arrayUnion(currentUid),
              followerCount: (targetSnap2.data()?.followerCount ?? 0) + 1,
            })
          })
          createNotification({
            userId: targetUserId,
            type: 'follow',
            fromUserId: currentUid,
          })
        } catch (e) {
          captureException(e instanceof Error ? e : new Error(String(e)), { context: 'follow' })
          setIsFollowing(false)
          setIsFriend(false)
          setFollowerCount((p) => Math.max(0, p - 1))
        }
      }
    }
  }, [isFollowing, isRequested, isFriend, targetUserId])

  const acceptFollowRequest = useCallback(async (fromUserId: string) => {
    if (!targetUserId) return
    try {
      await runTransaction(db, async (transaction) => {
        const [mySnap, fromSnap] = await Promise.all([
          transaction.get(doc(db, 'users', targetUserId)),
          transaction.get(doc(db, 'users', fromUserId)),
        ])
        transaction.update(doc(db, 'users', targetUserId), {
          followers: arrayUnion(fromUserId),
          followerCount: (mySnap.data()?.followerCount ?? 0) + 1,
          pendingFollowers: arrayRemove(fromUserId),
        })
        transaction.update(doc(db, 'users', fromUserId), {
          following: arrayUnion(targetUserId),
          followingCount: (fromSnap.data()?.followingCount ?? 0) + 1,
          pendingFollowings: arrayRemove(targetUserId),
        })
      })
      createNotification({
        userId: fromUserId,
        type: 'follow_accept',
        fromUserId: targetUserId,
      })
      setFollowerCount((p) => p + 1)
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'acceptFollowRequest' })
    }
  }, [targetUserId])

  const rejectFollowRequest = useCallback(async (fromUserId: string) => {
    if (!targetUserId) return
    try {
      await runTransaction(db, async (transaction) => {
        transaction.update(doc(db, 'users', targetUserId), {
          pendingFollowers: arrayRemove(fromUserId),
        })
        transaction.update(doc(db, 'users', fromUserId), {
          pendingFollowings: arrayRemove(targetUserId),
        })
      })
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'rejectFollowRequest' })
    }
  }, [targetUserId])

  return { isFollowing, isRequested, isFriend, followerCount, followingCount, loading, toggleFollow, acceptFollowRequest, rejectFollowRequest }
}
