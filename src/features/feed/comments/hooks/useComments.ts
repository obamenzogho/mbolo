import { useEffect, useRef, useState, useCallback } from 'react'
import { auth } from '../../../../lib/firebase'
import { captureException } from '../../../../lib/sentry'
import { createNotification } from '../../../../lib/notifications'
import { subscribeComments, addComment, removeComment } from '../services/commentsService'
import type { Comment } from '../../../../types'

export function useComments(videoId: string, videoOwnerId: string) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setLoading(true)
    unsubRef.current = subscribeComments(videoId, (c) => { setComments(c); setLoading(false) })
    return () => { unsubRef.current?.() }
  }, [videoId])

  const submit = useCallback(async (text: string) => {
    const user = auth.currentUser
    if (!user || !text.trim()) return
    setSending(true)
    try {
      await addComment(videoId, user.uid, text)
      if (videoOwnerId !== user.uid) {
        createNotification({ userId: videoOwnerId, type: 'comment', fromUserId: user.uid, videoId })
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'addComment' })
    } finally { setSending(false) }
  }, [videoId, videoOwnerId])

  const remove = useCallback(async (commentId: string) => {
    try { await removeComment(videoId, commentId) }
    catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'removeComment' }) }
  }, [videoId])

  return { comments, loading, sending, submit, remove }
}
