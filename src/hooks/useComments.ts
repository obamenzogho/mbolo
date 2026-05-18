import { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, onSnapshot, addDoc,
  doc, updateDoc, increment, arrayUnion, arrayRemove, serverTimestamp,
  getDoc, getDocs, limit,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'

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

export function useComments(videoId: string, visible: boolean) {
  const [comments, setComments] = useState<any[]>([])
  const [commentCount, setCommentCount] = useState(0)
  const [repliesData, setRepliesData] = useState<Record<string, any[]>>({})
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [inputText, setInputText] = useState('')
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null)
  const [sending, setSending] = useState(false)
  const currentUser = auth.currentUser

  useEffect(() => {
    if (!visible || !videoId || videoId.startsWith('demo-')) return
    const unsub = onSnapshot(doc(db, 'videos', videoId), (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        if (typeof d.comments === 'number') setCommentCount(d.comments)
      }
    })
    return () => unsub()
  }, [visible, videoId])

  useEffect(() => {
    if (!visible || !videoId || videoId.startsWith('demo-')) return
    const q = query(collection(db, 'videos', videoId, 'comments'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, async (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const enriched = await Promise.all(
        items.map(async (c: any) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', c.userId))
            if (userSnap.exists()) {
              return { ...c, authorName: userSnap.data().nom || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Utilisateur', authorPhoto: userSnap.data().photoURL }
            }
          } catch {}
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
      snap.docs.map(async (d) => {
        const data = d.data()
        try {
          const userSnap = await getDoc(doc(db, 'users', data.userId))
          if (userSnap.exists()) {
            return { id: d.id, ...data, authorName: userSnap.data().nom || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Utilisateur', authorPhoto: userSnap.data().photoURL }
          }
        } catch {}
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
    if (!trimmed || sending || !currentUser || videoId.startsWith('demo-')) return
    setSending(true)
    try {
      if (replyingTo) {
        await addDoc(collection(db, 'videos', videoId, 'comments', replyingTo.commentId, 'replies'), {
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
        await updateDoc(doc(db, 'videos', videoId, 'comments', replyingTo.commentId), {
          replyCount: increment(1),
        })
        await updateDoc(doc(db, 'videos', videoId), { comments: increment(1) })
        loadReplies(replyingTo.commentId)
      } else {
        await addDoc(collection(db, 'videos', videoId, 'comments'), {
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
        await updateDoc(doc(db, 'videos', videoId), { comments: increment(1) })
      }
      setInputText('')
      setReplyingTo(null)
    } catch (e) { console.error('sendComment error:', e) }
    setSending(false)
  }, [inputText, sending, currentUser, videoId, replyingTo, loadReplies])

  const cancelReply = useCallback(() => {
    setReplyingTo(null)
    setInputText('')
  }, [])

  const startReply = useCallback((commentId: string, username: string) => {
    setReplyingTo({ commentId, username })
  }, [])

  const likeComment = useCallback(async (commentId: string) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId)
    try {
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data()
        const likedBy = data.likedBy || []
        if (likedBy.includes(currentUser.uid)) {
          await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(currentUser.uid) })
        } else {
          await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(currentUser.uid) })
        }
      }
    } catch {}
  }, [currentUser, videoId])

  const likeReply = useCallback(async (commentId: string, replyId: string, likedByArr: string[] = []) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId, 'replies', replyId)
    try {
      if (likedByArr.includes(currentUser.uid)) {
        await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(currentUser.uid) })
      } else {
        await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(currentUser.uid) })
      }
    } catch {}
  }, [currentUser, videoId])

  const dislikeComment = useCallback(async (commentId: string) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId)
    try {
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data()
        const dislikedBy = data.dislikedBy || []
        if (dislikedBy.includes(currentUser.uid)) {
          await updateDoc(ref, { dislikes: increment(-1), dislikedBy: arrayRemove(currentUser.uid) })
        } else {
          await updateDoc(ref, { dislikes: increment(1), dislikedBy: arrayUnion(currentUser.uid) })
        }
      }
    } catch {}
  }, [currentUser, videoId])

  const dislikeReply = useCallback(async (commentId: string, replyId: string, dislikedByArr: string[] = []) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId, 'replies', replyId)
    try {
      if (dislikedByArr.includes(currentUser.uid)) {
        await updateDoc(ref, { dislikes: increment(-1), dislikedBy: arrayRemove(currentUser.uid) })
      } else {
        await updateDoc(ref, { dislikes: increment(1), dislikedBy: arrayUnion(currentUser.uid) })
      }
    } catch {}
  }, [currentUser, videoId])

  return {
    comments,
    commentCount,
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
    cancelCurrentReply: cancelReply,
  }
}