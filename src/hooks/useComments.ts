import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot, addDoc,
  doc, updateDoc, increment, arrayUnion, arrayRemove, serverTimestamp,
  getDoc, getDocs, limit, runTransaction,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { createNotification } from '../lib/notifications'
import { captureException } from '../lib/sentry'

export function formatCount(n: number | undefined | null): string {
  if (!n || n === 0) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + ' M'
  if (n >= 1000) return (n / 1000).toFixed(1) + ' K'
  return n.toString()
}

export function formatTime(timestamp: any): string {
  if (!timestamp) return ''
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  if (isNaN(date.getTime())) return ''
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return diff + ' sec'
  if (diff < 3600) return Math.floor(diff / 60) + ' min'
  if (diff < 86400) return Math.floor(diff / 3600) + ' h'
  return Math.floor(diff / 86400) + ' j'
}

export function useComments(videoId: string, visible: boolean, initialPreviews?: any[]) {
  const [comments, setComments] = useState<any[]>(initialPreviews ?? [])
  const [commentCount, setCommentCount] = useState(0)
  const [repliesData, setRepliesData] = useState<Record<string, any[]>>({})
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [inputText, setInputText] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [hasMoreComments, setHasMoreComments] = useState(true)
  const currentUser = auth.currentUser

  useEffect(() => {
    if (!visible || !videoId || videoId.startsWith('demo-')) return
    const unsub = onSnapshot(doc(db, 'videos', videoId), (snap: any) => {
      if (snap.exists()) {
        const d = snap.data()
        if (typeof d.comments === 'number') setCommentCount(d.comments)
        if (typeof d.commentsEnabled === 'boolean') setCommentsEnabled(d.commentsEnabled)
      }
    })
    return () => unsub()
  }, [visible, videoId])

  useEffect(() => {
    if (!visible || !videoId || videoId.startsWith('demo-')) return
    const q = query(collection(db, 'videos', videoId, 'comments'), orderBy('createdAt', 'desc'), limit(20))
    const unsub = onSnapshot(q, async (snap: any) => {
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
      setHasMoreComments(items.length >= 20)
      const enriched = await Promise.all(
        items.map(async (c: any) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', c.userId))
            if (userSnap.exists()) {
              return { ...c, authorName: userSnap.data().nom || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Utilisateur', authorPhoto: userSnap.data().photoURL }
            }
          } catch (e) { console.warn('getCommentAuthor error:', e) }
          if (c.userId === currentUser?.uid) {
            return { ...c, authorName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Utilisateur' }
          }
          return c
        })
      )
      setComments(enriched)
    })
    return () => unsub()
  }, [visible, videoId])

  const loadReplies = useCallback(async (commentId: string) => {
    const q = query(
      collection(db, 'videos', videoId, 'comments', commentId, 'replies'),
      orderBy('createdAt', 'asc'),
      limit(20)
    )
    const snap = await getDocs(q)
    const enriched = await Promise.all(
      snap.docs.map(async (d: any) => {
        const data = d.data()
        try {
          const userSnap = await getDoc(doc(db, 'users', data.userId))
          if (userSnap.exists()) {
            return { id: d.id, ...data, authorName: userSnap.data().nom || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Utilisateur', authorPhoto: userSnap.data().photoURL }
          }
        } catch (e) { console.warn('getReplyAuthor error:', e) }
        if (data.userId === currentUser?.uid) {
          return { id: d.id, ...data, authorName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Utilisateur' }
        }
        return { id: d.id, ...data }
      })
    )
    setRepliesData((prev) => ({ ...prev, [commentId]: enriched }))
    setExpandedReplies((prev) => ({ ...prev, [commentId]: true }))
  }, [videoId])

  const toggleReplies = useCallback((commentId: string) => {
    setExpandedReplies((prev) => {
      if (prev[commentId]) return { ...prev, [commentId]: false }
      loadReplies(commentId)
      return { ...prev, [commentId]: true }
    })
  }, [loadReplies])

  const sendComment = useCallback(async () => {
    const trimmed = inputText.trim()
    if (!trimmed || sending || !currentUser || videoId.startsWith('demo-') || !commentsEnabled) return
    setSending(true)
    try {
      await runTransaction(db, async (transaction) => {
        const videoRef = doc(db, 'videos', videoId)
        const videoSnap = await transaction.get(videoRef)
        if (!videoSnap.exists() || videoSnap.data().commentsEnabled === false) return
        const currentData = videoSnap.data()
        const currentPreview = currentData?.previewComments ?? []
        const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Utilisateur'
        if (replyingTo) {
          const replyRef = doc(collection(db, 'videos', videoId, 'comments', replyingTo.commentId, 'replies'))
          transaction.set(replyRef, {
            userId: currentUser.uid,
            videoId,
            text: trimmed,
            replyToUsername: replyingTo.username,
            username: currentUser.displayName || currentUser.email?.split('@')[0] || 'Utilisateur',
            likes: 0,
            likedBy: [],
            dislikes: 0,
            dislikedBy: [],
            createdAt: serverTimestamp(),
          })
          const commentRef = doc(db, 'videos', videoId, 'comments', replyingTo.commentId)
          transaction.update(commentRef, { replyCount: increment(1) })
          transaction.update(videoRef, { comments: increment(1) })
        } else {
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
        }
      })
      if (replyingTo) {
        loadReplies(replyingTo.commentId)
      }
      setInputText('')
      setReplyingTo(null)
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'sendComment' }); console.error('sendComment error:', e) }
    setSending(false)
  }, [inputText, sending, currentUser, videoId, replyingTo, loadReplies, commentsEnabled])

  const cancelReply = useCallback(() => {
    setReplyingTo(null)
    setInputText('')
  }, [])

  const startReply = useCallback((commentId: string, username: string) => {
    setReplyingTo({ commentId, username })
  }, [])

  const likeComment = useCallback(async (commentId: string, liked: boolean) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId)
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref)
        if (!snap.exists()) return
        const uid = currentUser.uid
        const data = snap.data()
        const wasLiked = (data.likedBy ?? []).includes(uid)
        const wasDisliked = (data.dislikedBy ?? []).includes(uid)

        if (liked && !wasLiked) {
          const updates: Record<string, any> = {
            likes: increment(1),
            likedBy: arrayUnion(uid),
            dislikedBy: arrayRemove(uid),
          }
          if (wasDisliked) updates.dislikes = increment(-1)
          transaction.update(ref, updates)
        } else if (!liked && wasLiked) {
          transaction.update(ref, {
            likes: increment(-1),
            likedBy: arrayRemove(uid),
          })
        }
      })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'likeComment' }); console.warn('likeComment error:', e) }
  }, [currentUser, videoId])

  const likeReply = useCallback(async (commentId: string, replyId: string, liked: boolean) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId, 'replies', replyId)
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref)
        if (!snap.exists()) return
        const uid = currentUser.uid
        const data = snap.data()
        const wasLiked = (data.likedBy ?? []).includes(uid)
        const wasDisliked = (data.dislikedBy ?? []).includes(uid)

        if (liked && !wasLiked) {
          const updates: Record<string, any> = {
            likes: increment(1),
            likedBy: arrayUnion(uid),
            dislikedBy: arrayRemove(uid),
          }
          if (wasDisliked) updates.dislikes = increment(-1)
          transaction.update(ref, updates)
        } else if (!liked && wasLiked) {
          transaction.update(ref, {
            likes: increment(-1),
            likedBy: arrayRemove(uid),
          })
        }
      })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'likeReply' }); console.warn('likeReply error:', e) }
  }, [currentUser, videoId])

  const dislikeComment = useCallback(async (commentId: string, disliked: boolean) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId)
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref)
        if (!snap.exists()) return
        const uid = currentUser.uid
        const data = snap.data()
        const wasDisliked = (data.dislikedBy ?? []).includes(uid)
        const wasLiked = (data.likedBy ?? []).includes(uid)

        if (disliked && !wasDisliked) {
          const updates: Record<string, any> = {
            dislikes: increment(1),
            dislikedBy: arrayUnion(uid),
            likedBy: arrayRemove(uid),
          }
          if (wasLiked) updates.likes = increment(-1)
          transaction.update(ref, updates)
        } else if (!disliked && wasDisliked) {
          transaction.update(ref, {
            dislikes: increment(-1),
            dislikedBy: arrayRemove(uid),
          })
        }
      })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'dislikeComment' }); console.warn('dislikeComment error:', e) }
  }, [currentUser, videoId])

  const dislikeReply = useCallback(async (commentId: string, replyId: string, disliked: boolean) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId, 'replies', replyId)
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref)
        if (!snap.exists()) return
        const uid = currentUser.uid
        const data = snap.data()
        const wasDisliked = (data.dislikedBy ?? []).includes(uid)
        const wasLiked = (data.likedBy ?? []).includes(uid)

        if (disliked && !wasDisliked) {
          const updates: Record<string, any> = {
            dislikes: increment(1),
            dislikedBy: arrayUnion(uid),
            likedBy: arrayRemove(uid),
          }
          if (wasLiked) updates.likes = increment(-1)
          transaction.update(ref, updates)
        } else if (!disliked && wasDisliked) {
          transaction.update(ref, {
            dislikes: increment(-1),
            dislikedBy: arrayRemove(uid),
          })
        }
      })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'dislikeReply' }); console.warn('dislikeReply error:', e) }
  }, [currentUser, videoId])

  const deleteComment = useCallback(async (commentId: string) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId)
    try {
      const snap = await getDoc(ref)
      if (!snap.exists() || snap.data().userId !== currentUser.uid) return
      await runTransaction(db, async (transaction) => {
        const snap2 = await transaction.get(ref)
        if (!snap2.exists() || snap2.data().userId !== currentUser.uid) return
        const replyCount = snap2.data().replyCount || 0
        transaction.delete(ref)
        transaction.update(doc(db, 'videos', videoId), { comments: increment(-1 - replyCount) })
      })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteComment' }); console.warn('deleteComment error:', e) }
  }, [currentUser, videoId])

  const deleteReply = useCallback(async (commentId: string, replyId: string) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId, 'replies', replyId)
    try {
      const snap = await getDoc(ref)
      if (!snap.exists() || snap.data().userId !== currentUser.uid) return
      await runTransaction(db, async (transaction) => {
        transaction.delete(ref)
        transaction.update(doc(db, 'videos', videoId, 'comments', commentId), { replyCount: increment(-1) })
        transaction.update(doc(db, 'videos', videoId), { comments: increment(-1) })
      })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteReply' }); console.warn('deleteReply error:', e) }
  }, [currentUser, videoId])

  return {
    comments,
    commentCount,
    commentsEnabled,
    hasMoreComments,
    repliesData,
    expandedReplies,
    inputText,
    replyingTo,
    sending,
    currentUser,
    setInputText,
    sendComment,
    cancelReply,
    startReply,
    likeComment,
    likeReply,
    dislikeComment,
    dislikeReply,
    toggleReplies,
    loadReplies,
    deleteComment,
    deleteReply,
    cancelCurrentReply: cancelReply,
  }
}
