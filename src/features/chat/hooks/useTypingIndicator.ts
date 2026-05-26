import { useRef, useCallback, useEffect } from 'react'
// @ts-ignore - deleteField exported at runtime despite TS types
import { doc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const TYPING_TIMEOUT = 3000

export function useTypingIndicator(conversationId: string | null, userId: string | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopTyping = useCallback(async () => {
    if (!conversationId || !userId) return
    clear()
    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        [`typingBy.${userId}`]: deleteField(),
      })
    } catch {}
  }, [conversationId, userId, clear])

  const startTyping = useCallback(async () => {
    if (!conversationId || !userId) return
    clear()
    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        [`typingBy.${userId}`]: serverTimestamp(),
      })
    } catch {}
    timerRef.current = setTimeout(stopTyping, TYPING_TIMEOUT)
  }, [conversationId, userId, clear, stopTyping])

  useEffect(() => {
    return () => {
      stopTyping()
    }
  }, [stopTyping])

  return { startTyping, stopTyping }
}
