import { useState, useCallback, useEffect } from 'react'
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

export function useFollow(targetUserId: string) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!targetUserId) return
    let cancelled = false
    const checkFollow = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', targetUserId))
        if (!cancelled && snap.exists()) {
          const data = snap.data()
          const currentUid = auth.currentUser?.uid
          setIsFollowing(data.followers?.includes(currentUid) ?? false)
          setFollowerCount(data.followers?.length || 0)
          setFollowingCount(data.following?.length || 0)
        }
      } catch {}
      if (!cancelled) setLoading(false)
    }
    checkFollow()
    return () => { cancelled = true }
  }, [targetUserId])

  const toggleFollow = useCallback(async () => {
    const currentUid = auth.currentUser?.uid
    if (!currentUid || !targetUserId) return

    const userRef = doc(db, 'users', currentUid)
    const targetRef = doc(db, 'users', targetUserId)

    if (isFollowing) {
      setIsFollowing(false)
      setFollowerCount((p) => Math.max(0, p - 1))
      try {
        await updateDoc(userRef, { following: arrayRemove(targetUserId) })
        await updateDoc(targetRef, { followers: arrayRemove(currentUid) })
      } catch {
        setIsFollowing(true)
        setFollowerCount((p) => p + 1)
      }
    } else {
      setIsFollowing(true)
      setFollowerCount((p) => p + 1)
      try {
        await updateDoc(userRef, { following: arrayUnion(targetUserId) })
        await updateDoc(targetRef, { followers: arrayUnion(currentUid) })
      } catch {
        setIsFollowing(false)
        setFollowerCount((p) => Math.max(0, p - 1))
      }
    }
  }, [isFollowing, targetUserId])

  return { isFollowing, followerCount, followingCount, loading, toggleFollow }
}
