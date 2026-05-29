import { useCallback } from 'react'
import {
  doc, updateDoc, increment, arrayUnion, arrayRemove,
  runTransaction, collection, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from '../../../lib/firebase'
import { createNotification } from '../../../lib/notifications'
import { captureException } from '../../../lib/sentry'
import { FEED_DEBUG } from '../store/feedStore'

export function useCommentActions(videoId: string, videoOwnerId: string) {
  const currentUser = auth.currentUser

  const likeComment = useCallback(async (commentId: string, isLiked: boolean) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId)
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref)
        if (!snap.exists()) return
        const uid = currentUser.uid
        const data = snap.data()
        const wasLiked = (data.likedBy ?? []).includes(uid)
        if (isLiked && !wasLiked) {
          const updates: Record<string, unknown> = {
            likes: increment(1),
            likedBy: arrayUnion(uid),
          }
          if ((data.dislikedBy ?? []).includes(uid)) {
            updates.dislikes = increment(-1)
            updates.dislikedBy = arrayRemove(uid)
          }
          transaction.update(ref, updates)
        } else if (!isLiked && wasLiked) {
          transaction.update(ref, { likes: increment(-1), likedBy: arrayRemove(uid) })
        }
      })
      if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: likeComment', commentId, isLiked)
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'likeComment' }) }
  }, [currentUser, videoId])

  const likeReply = useCallback(async (commentId: string, replyId: string, isLiked: boolean) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId, 'replies', replyId)
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref)
        if (!snap.exists()) return
        const uid = currentUser.uid
        const data = snap.data()
        const wasLiked = (data.likedBy ?? []).includes(uid)
        if (isLiked && !wasLiked) {
          const updates: Record<string, unknown> = {
            likes: increment(1),
            likedBy: arrayUnion(uid),
          }
          if ((data.dislikedBy ?? []).includes(uid)) {
            updates.dislikes = increment(-1)
            updates.dislikedBy = arrayRemove(uid)
          }
          transaction.update(ref, updates)
        } else if (!isLiked && wasLiked) {
          transaction.update(ref, { likes: increment(-1), likedBy: arrayRemove(uid) })
        }
      })
      if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: likeReply', replyId, isLiked)
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'likeReply' }) }
  }, [currentUser, videoId])

  const deleteComment = useCallback(async (commentId: string) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId)
    try {
      const snap = await runTransaction(db, async (transaction) => {
        const s = await transaction.get(ref)
        if (!s.exists() || s.data().userId !== currentUser.uid) return false
        const replyCount = s.data().replyCount || 0
        transaction.delete(ref)
        transaction.update(doc(db, 'videos', videoId), { comments: increment(-1 - replyCount) })
        return true
      })
      if (snap && FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: deleteComment', commentId)
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteComment' }) }
  }, [currentUser, videoId])

  const deleteReply = useCallback(async (commentId: string, replyId: string) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId, 'replies', replyId)
    try {
      await runTransaction(db, async (transaction) => {
        const s = await transaction.get(ref)
        if (!s.exists() || s.data().userId !== currentUser.uid) return
        transaction.delete(ref)
        transaction.update(doc(db, 'videos', videoId, 'comments', commentId), { replyCount: increment(-1) })
        transaction.update(doc(db, 'videos', videoId), { comments: increment(-1) })
      })
      if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: deleteReply', replyId)
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteReply' }) }
  }, [currentUser, videoId])

  const reportComment = useCallback(async (commentId: string) => {
    if (!currentUser) return
    try {
      await addDoc(collection(db, 'reports'), {
        type: 'comment',
        videoId,
        commentId,
        reportedBy: currentUser.uid,
        createdAt: serverTimestamp(),
      })
      if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: reportComment', commentId)
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'reportComment' }) }
  }, [currentUser, videoId])

  const addComment = useCallback(async (text: string) => {
    if (!currentUser || !text.trim()) return
    const trimmed = text.trim()
    try {
      await runTransaction(db, async (transaction) => {
        const videoRef = doc(db, 'videos', videoId)
        const videoSnap = await transaction.get(videoRef)
        const currentData = videoSnap.data()
        const currentPreview = currentData?.previewComments ?? []
        const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Utilisateur'

        const commentRef = doc(collection(db, 'videos', videoId, 'comments'))
        transaction.set(commentRef, {
          userId: currentUser.uid,
          videoId,
          text: trimmed,
          likes: 0,
          likedBy: [],
          dislikes: 0,
          dislikedBy: [],
          replyCount: 0,
          createdAt: serverTimestamp(),
        })
        transaction.update(videoRef, {
          comments: increment(1),
          previewComments: [
            { id: commentRef.id, text: trimmed, authorName: displayName, authorPhoto: currentUser.photoURL || null, likes: 0 },
            ...currentPreview,
          ].slice(0, 3),
        })
      })
      if (videoOwnerId) {
        createNotification({ userId: videoOwnerId, type: 'comment', fromUserId: currentUser.uid, videoId })
      }
      if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: addComment', videoId)
      return trimmed
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'addComment' }) }
    return ''
  }, [currentUser, videoId, videoOwnerId])

  const addReply = useCallback(async (commentId: string, text: string, replyToUsername: string | null) => {
    if (!currentUser || !text.trim()) return
    const trimmed = text.trim()
    try {
      await runTransaction(db, async (transaction) => {
        const videoRef = doc(db, 'videos', videoId)
        const replyRef = doc(collection(db, 'videos', videoId, 'comments', commentId, 'replies'))
        transaction.set(replyRef, {
          userId: currentUser.uid,
          videoId,
          text: trimmed,
          replyToUsername,
          username: currentUser.displayName || null,
          likes: 0,
          likedBy: [],
          dislikes: 0,
          dislikedBy: [],
          createdAt: serverTimestamp(),
        })
        transaction.update(doc(db, 'videos', videoId, 'comments', commentId), { replyCount: increment(1) })
        transaction.update(videoRef, { comments: increment(1) })
      })
      if (videoOwnerId) {
        createNotification({ userId: videoOwnerId, type: 'reply', fromUserId: currentUser.uid, videoId })
      }
      if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: addReply', commentId, videoId)
      return trimmed
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'addReply' }) }
    return ''
  }, [currentUser, videoId, videoOwnerId])

  const unlikeComment = useCallback((commentId: string) => likeComment(commentId, false), [likeComment])

  return { likeComment, unlikeComment, deleteComment, reportComment, likeReply, deleteReply, addComment, addReply }
}
