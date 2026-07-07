import { useCallback, useEffect, useState } from 'react'
import { doc, updateDoc, increment, arrayUnion, arrayRemove, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../../../lib/firebase'
import { createNotification } from '../../../../lib/notifications'
import { captureException } from '../../../../lib/sentry'
import type { Video } from '../../../../types'

export function useFeedItemActions(item: Video) {
  const uid = auth.currentUser?.uid ?? ''
  const [liked, setLiked] = useState(item.likedBy?.includes(uid) ?? false)
  const [saved, setSaved] = useState(item.savedBy?.includes(uid) ?? false)
  const [likeCount, setLikeCount] = useState(item.likes)
  const [saveCount, setSaveCount] = useState(item.saves)

  useEffect(() => {
    const u = auth.currentUser?.uid ?? ''
    setLiked(item.likedBy?.includes(u) ?? false)
    setSaved(item.savedBy?.includes(u) ?? false)
    setLikeCount(item.likes)
    setSaveCount(item.saves)
  }, [item.id, item.likes, item.saves, item.likedBy, item.savedBy])

  const toggleLike = useCallback(async (opts?: { force?: boolean }) => {
    const user = auth.currentUser
    if (!user) return
    if (opts?.force && liked) return
    const videoRef = doc(db, 'videos', item.id)
    const likeRef = doc(db, 'videos', item.id, 'likes', user.uid)
    const willLike = opts?.force ? true : !liked

    setLiked(willLike)
    setLikeCount((p) => Math.max(0, willLike ? p + 1 : p - 1))

    try {
      if (willLike) {
        await setDoc(likeRef, { createdAt: Date.now() })
        await updateDoc(videoRef, { likes: increment(1) })
        createNotification({ userId: item.userId, type: 'like', fromUserId: user.uid, videoId: item.id })
      } else {
        await deleteDoc(likeRef)
        await updateDoc(videoRef, { likes: increment(-1) })
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'toggleLike' })
      setLiked(!willLike)
      setLikeCount((p) => Math.max(0, willLike ? p - 1 : p + 1))
    }
  }, [liked, item.id, item.userId])

  const doubleTapLike = useCallback(async () => {
    const user = auth.currentUser
    if (!user || liked) return
    setLiked(true)
    setLikeCount((p) => p + 1)
    try {
      await setDoc(doc(db, 'videos', item.id, 'likes', user.uid), { createdAt: Date.now() })
      await updateDoc(doc(db, 'videos', item.id), { likes: increment(1) })
      createNotification({ userId: item.userId, type: 'like', fromUserId: user.uid, videoId: item.id })
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'doubleTapLike' })
      setLiked(false)
      setLikeCount((p) => Math.max(0, p - 1))
    }
  }, [liked, item.id, item.userId])

  const toggleSave = useCallback(async () => {
    const user = auth.currentUser
    if (!user) return
    const videoRef = doc(db, 'videos', item.id)
    const saveRef = doc(db, 'videos', item.id, 'saves', user.uid)
    const willSave = !saved

    setSaved(willSave)
    setSaveCount((p) => Math.max(0, willSave ? p + 1 : p - 1))

    try {
      if (willSave) {
        await setDoc(saveRef, { createdAt: Date.now() })
        await updateDoc(videoRef, { saves: increment(1) })
      } else {
        await deleteDoc(saveRef)
        await updateDoc(videoRef, { saves: increment(-1) })
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'toggleSave' })
      setSaved(!willSave)
      setSaveCount((p) => Math.max(0, willSave ? p - 1 : p + 1))
    }
  }, [saved, item.id])

  return { liked, saved, likeCount, saveCount, toggleLike, doubleTapLike, toggleSave }
}
