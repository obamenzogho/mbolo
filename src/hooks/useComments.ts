import { useState, useEffect, useCallback, useRef } from 'react'
import {
  collection, query, orderBy, onSnapshot, addDoc, startAfter,
  doc, increment, arrayUnion, arrayRemove, serverTimestamp, updateDoc,
  getDoc, getDocs, limit, runTransaction, deleteDoc, type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { batchFetchAuthors, type AuthorInfo } from '../lib/firestore'
import { createNotification } from '../lib/notifications'
import { captureException } from '../lib/sentry'
import { extractMentions, resolveMentions } from '../features/feed/comments/mentions'

const COMMENTS_PAGE = 20
const REPLIES_PAGE = 20

export function matchesBlockedWords(text: string, blocked: string[]): boolean {
  if (blocked.length === 0) return false
  const lower = text.toLowerCase()
  return blocked.some((w) => w && new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower))
}

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

async function enrichWithAuthors(items: any[], authorCache: Map<string, AuthorInfo>): Promise<any[]> {
  // ✅ Fetch authors ONLY for legacy docs missing the denormalized fields.
  // New comments/replies already carry authorName + authorPhoto (zero extra read).
  const missingIds = items
    .filter((c) => !c.authorName && c.userId && !authorCache.has(c.userId))
    .map((c) => c.userId)

  if (missingIds.length > 0) {
    const fetched = await batchFetchAuthors(missingIds)
    fetched.forEach((info, id) => authorCache.set(id, info))
  }

  return items.map((c) => {
    // ✅ Denormalized field takes priority; fall back to cache for legacy docs.
    if (c.authorName) return c
    const author = authorCache.get(c.userId)
    return author ? { ...c, authorName: author.name, authorPhoto: author.photo } : c
  })
}

export function useComments(videoId: string, visible: boolean, initialPreviews?: any[], videoOwnerId?: string) {
  const [comments, setComments] = useState<any[]>(initialPreviews ?? [])
  const [commentCount, setCommentCount] = useState(0)
  const [repliesData, setRepliesData] = useState<Record<string, any[]>>({})
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [hasMoreComments, setHasMoreComments] = useState(true)
  const [hasMoreReplies, setHasMoreReplies] = useState<Record<string, boolean>>({})
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingMoreReplies, setLoadingMoreReplies] = useState<Record<string, boolean>>({})
  const [blockedWords, setBlockedWords] = useState<string[]>([])
  const currentUser = auth.currentUser
  const authorCacheRef = useRef<Map<string, AuthorInfo>>(new Map())
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null)
  const replyUnsubsRef = useRef<Map<string, () => void>>(new Map())
  const lastReplyDocRef = useRef<Map<string, QueryDocumentSnapshot | null>>(new Map())

  // Live comment count from the video doc
  useEffect(() => {
    if (!visible || !videoId || videoId.startsWith('demo-')) return
    const unsub = onSnapshot(doc(db, 'videos', videoId), (snap: any) => {
      if (snap.exists()) {
        const d = snap.data()
        if (typeof d.comments === 'number') setCommentCount(d.comments)
      }
    })
    return () => unsub()
  }, [visible, videoId])

  // Page 1 comments — live (real-time), merged with the paginated tail.
  // The onSnapshot keeps the first COMMENTS_PAGE comments up-to-date in
  // real-time while preserving older comments loaded via loadMoreComments.
  useEffect(() => {
    if (!visible || !videoId || videoId.startsWith('demo-')) return
    lastDocRef.current = null
    setHasMoreComments(true)

    const q = query(collection(db, 'videos', videoId, 'comments'), orderBy('createdAt', 'desc'), limit(COMMENTS_PAGE))
    const unsub = onSnapshot(q, async (snap: any) => {
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((c: any) => c.moderationStatus !== 'hidden')
      // Only set the cursor on the very first emission. Subsequent real-time
      // updates must NOT reset it, otherwise loadMoreComments would re-fetch
      // page 2 and produce duplicates.
      if (!lastDocRef.current && snap.docs.length > 0) {
        lastDocRef.current = snap.docs[snap.docs.length - 1]
      }
      setHasMoreComments(items.length >= COMMENTS_PAGE)
      const enriched = await enrichWithAuthors(items, authorCacheRef.current)
      // Merge: replace the live window (page 1) with fresh data while keeping
      // paginated comments (pages 2+) that fell outside the live window.
      setComments((prev) => {
        const liveIds = new Set(enriched.map((c) => c.id))
        const paginatedTail = prev.filter((c) => !liveIds.has(c.id))
        return [...enriched, ...paginatedTail]
      })
    })
    return () => unsub()
  }, [visible, videoId])

  const loadMoreComments = useCallback(async () => {
    if (!hasMoreComments || loadingMore || !videoId || !lastDocRef.current) return
    setLoadingMore(true)
    try {
      const q = query(
        collection(db, 'videos', videoId, 'comments'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(COMMENTS_PAGE)
      )
      const snap = await getDocs(q)
      if (snap.docs.length > 0) {
        lastDocRef.current = snap.docs[snap.docs.length - 1]
        const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
        const enriched = await enrichWithAuthors(items, authorCacheRef.current)
        setComments((prev) => [...prev, ...enriched])
      }
      setHasMoreComments(snap.docs.length >= COMMENTS_PAGE)
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'loadMoreComments' })
    }
    setLoadingMore(false)
  }, [videoId, hasMoreComments, loadingMore])

  // Cleanup all reply listeners on unmount
  useEffect(() => {
    return () => {
      replyUnsubsRef.current.forEach((unsub) => unsub())
      replyUnsubsRef.current.clear()
    }
  }, [])

  // Load blocked words from creator's profile
  useEffect(() => {
    if (!videoOwnerId) return
    let cancelled = false
    getDoc(doc(db, 'users', videoOwnerId)).then((snap) => {
      if (cancelled || !snap.exists()) return
      const words = snap.data()?.blockedWords
      if (Array.isArray(words)) setBlockedWords(words.map((w: string) => w.toLowerCase()))
    })
    return () => { cancelled = true }
  }, [videoOwnerId])

  const loadReplies = useCallback((commentId: string) => {
    const existingUnsub = replyUnsubsRef.current.get(commentId)
    if (existingUnsub) return

    const q = query(
      collection(db, 'videos', videoId, 'comments', commentId, 'replies'),
      orderBy('createdAt', 'asc'),
      limit(REPLIES_PAGE)
    )
    const unsub = onSnapshot(q, async (snap: any) => {
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((c: any) => c.moderationStatus !== 'hidden')
      // Track cursor on first emission only (same rationale as comments).
      if (!lastReplyDocRef.current.has(commentId) && snap.docs.length > 0) {
        lastReplyDocRef.current.set(commentId, snap.docs[snap.docs.length - 1])
      }
      setHasMoreReplies((prev) => ({ ...prev, [commentId]: items.length >= REPLIES_PAGE }))
      const enriched = await enrichWithAuthors(items, authorCacheRef.current)
      setRepliesData((prev) => ({ ...prev, [commentId]: enriched }))
      setExpandedReplies((prev) => ({ ...prev, [commentId]: true }))
    })
    replyUnsubsRef.current.set(commentId, unsub)
  }, [videoId])

  const loadMoreReplies = useCallback(async (commentId: string) => {
    if (loadingMoreReplies[commentId] || !hasMoreReplies[commentId]) return
    const lastDoc = lastReplyDocRef.current.get(commentId)
    if (!lastDoc) return

    setLoadingMoreReplies((prev) => ({ ...prev, [commentId]: true }))
    try {
      const q = query(
        collection(db, 'videos', videoId, 'comments', commentId, 'replies'),
        orderBy('createdAt', 'asc'),
        startAfter(lastDoc),
        limit(REPLIES_PAGE)
      )
      const snap = await getDocs(q)
      if (snap.docs.length > 0) {
        lastReplyDocRef.current.set(commentId, snap.docs[snap.docs.length - 1])
        const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
        const enriched = await enrichWithAuthors(items, authorCacheRef.current)
        setRepliesData((prev) => ({
          ...prev,
          [commentId]: [...(prev[commentId] ?? []), ...enriched],
        }))
      }
      setHasMoreReplies((prev) => ({ ...prev, [commentId]: snap.docs.length >= REPLIES_PAGE }))
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'loadMoreReplies' })
    }
    setLoadingMoreReplies((prev) => ({ ...prev, [commentId]: false }))
  }, [videoId, loadingMoreReplies, hasMoreReplies])

  const toggleReplies = useCallback((commentId: string) => {
    setExpandedReplies((prev) => {
      if (prev[commentId]) {
        // Collapse: unsubscribe listener and reset pagination state
        const unsub = replyUnsubsRef.current.get(commentId)
        if (unsub) {
          unsub()
          replyUnsubsRef.current.delete(commentId)
        }
        lastReplyDocRef.current.delete(commentId)
        setHasMoreReplies((prevH) => {
          const next = { ...prevH }
          delete next[commentId]
          return next
        })
        setRepliesData((prevR) => {
          const next = { ...prevR }
          delete next[commentId]
          return next
        })
        return { ...prev, [commentId]: false }
      }
      loadReplies(commentId)
      return { ...prev, [commentId]: true }
    })
  }, [loadReplies])

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

          // Notify comment author when creator likes their comment
          if (uid === videoOwnerId && data.userId !== uid) {
            createNotification({
              userId: data.userId,
              type: 'like',
              fromUserId: uid,
              videoId,
            }).catch((e) => captureException(e instanceof Error ? e : new Error(String(e)), { context: 'likeComment:notification' }))
          }
        } else if (!liked && wasLiked) {
          transaction.update(ref, {
            likes: increment(-1),
            likedBy: arrayRemove(uid),
          })
        }
      })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'likeComment' }) }
  }, [currentUser, videoId, videoOwnerId])

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
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'likeReply' }) }
  }, [currentUser, videoId])

  const deleteComment = useCallback(async (commentId: string) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId)
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref)
        if (!snap.exists() || snap.data().userId !== currentUser.uid) return
        transaction.delete(ref)
        // ✅ compteur géré par onCommentDelete (serveur)
      })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteComment' }) }
  }, [currentUser, videoId])

  const deleteReply = useCallback(async (commentId: string, replyId: string) => {
    if (!currentUser) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId, 'replies', replyId)
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref)
        if (!snap.exists() || snap.data().userId !== currentUser.uid) return
        transaction.delete(ref)
        // ✅ replyCount + comments gérés par onReplyDelete (serveur)
      })
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
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'reportComment' }) }
  }, [currentUser, videoId])

  const addComment = useCallback(async (text: string) => {
    if (!currentUser || !text.trim()) return
    const trimmed = text.trim()
    try {
      await runTransaction(db, async (transaction) => {
        const videoRef = doc(db, 'videos', videoId)
        const videoSnap = await transaction.get(videoRef)
        if (!videoSnap.exists() || videoSnap.data().commentsEnabled === false) return
        const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Utilisateur'

        const commentRef = doc(collection(db, 'videos', videoId, 'comments'))
        transaction.set(commentRef, {
          userId: currentUser.uid,
          authorName: displayName,
          authorPhoto: currentUser.photoURL || null,
          videoId,
          text: trimmed,
          likes: 0,
          likedBy: [],
          dislikes: 0,
          dislikedBy: [],
          replyCount: 0,
          createdAt: serverTimestamp(),
        })
        // ✅ compteur + previewComments gérés par onCommentCreate (serveur)
      })
      if (videoOwnerId && videoOwnerId !== currentUser.uid) {
        createNotification({ userId: videoOwnerId, type: 'comment', fromUserId: currentUser.uid, videoId })
      }
      const pseudos = extractMentions(trimmed)
      if (pseudos.length > 0) {
        const map = await resolveMentions(pseudos)
        for (const uid of Object.values(map)) {
          if (uid !== currentUser.uid && uid !== videoOwnerId) {
            createNotification({ userId: uid, type: 'mention', fromUserId: currentUser.uid, videoId })
          }
        }
      }
      return trimmed
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'addComment' }) }
    return ''
  }, [currentUser, videoId, videoOwnerId])

  const addReply = useCallback(async (commentId: string, text: string, replyToUsername: string | null) => {
    if (!currentUser || !text.trim()) return
    const trimmed = text.trim()
    try {
      await runTransaction(db, async (transaction) => {
        const replyRef = doc(collection(db, 'videos', videoId, 'comments', commentId, 'replies'))
        transaction.set(replyRef, {
          userId: currentUser.uid,
          authorName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Utilisateur',
          authorPhoto: currentUser.photoURL || null,
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
        // ✅ replyCount + comments gérés par onReplyCreate (serveur)
      })

      try {
        const parentCommentSnap = await getDoc(doc(db, 'videos', videoId, 'comments', commentId))
        const parentUserId = parentCommentSnap.exists() ? parentCommentSnap.data()?.userId : null
        if (parentUserId && parentUserId !== currentUser.uid) {
          createNotification({ userId: parentUserId, type: 'reply', fromUserId: currentUser.uid, videoId })
        }
        if (videoOwnerId && videoOwnerId !== currentUser.uid && videoOwnerId !== parentUserId) {
          createNotification({ userId: videoOwnerId, type: 'reply', fromUserId: currentUser.uid, videoId })
        }
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'addReply-parent-fetch' })
      }

      const pseudos = extractMentions(trimmed)
      if (pseudos.length > 0) {
        const map = await resolveMentions(pseudos)
        for (const uid of Object.values(map)) {
          if (uid !== currentUser.uid && uid !== videoOwnerId) {
            createNotification({ userId: uid, type: 'mention', fromUserId: currentUser.uid, videoId })
          }
        }
      }

      return trimmed
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'addReply' }) }
    return ''
  }, [currentUser, videoId, videoOwnerId])

  const pinComment = useCallback(async (commentId: string, pinned: boolean) => {
    if (!currentUser || currentUser.uid !== videoOwnerId) return
    try {
      if (pinned) {
        const prev = comments.filter((c: any) => c.pinned && c.id !== commentId)
        await Promise.all(prev.map((c: any) =>
          updateDoc(doc(db, 'videos', videoId, 'comments', c.id), { pinned: false })))
      }
      await updateDoc(doc(db, 'videos', videoId, 'comments', commentId), { pinned })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'pinComment' }) }
  }, [currentUser, videoOwnerId, videoId, comments])

  const hideComment = useCallback(async (commentId: string, hidden: boolean) => {
    if (!currentUser || currentUser.uid !== videoOwnerId) return
    try {
      await updateDoc(doc(db, 'videos', videoId, 'comments', commentId), { hidden })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'hideComment' }) }
  }, [currentUser, videoOwnerId, videoId])

  const editComment = useCallback(async (commentId: string, newText: string) => {
    if (!currentUser) return
    const trimmed = newText.trim()
    if (!trimmed) return
    const ref = doc(db, 'videos', videoId, 'comments', commentId)
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists() || snap.data().userId !== currentUser.uid) return
        tx.update(ref, { text: trimmed, edited: true, editedAt: serverTimestamp() })
      })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'editComment' }) }
  }, [currentUser, videoId])

  return {
    comments,
    commentCount,
    hasMoreComments,
    loadingMore,
    repliesData,
    expandedReplies,
    hasMoreReplies,
    loadingMoreReplies,
    currentUser,
    likeComment,
    likeReply,
    toggleReplies,
    deleteComment,
    deleteReply,
    reportComment,
    addComment,
    addReply,
    pinComment,
    editComment,
    hideComment,
    blockedWords,
    loadMoreComments,
    loadMoreReplies,
  }
}
