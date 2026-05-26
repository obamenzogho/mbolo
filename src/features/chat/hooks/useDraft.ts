import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const DRAFT_PREFIX = '@draft_'

export function useDraft(conversationId: string | null) {
  const [draft, setDraftState] = useState('')

  useEffect(() => {
    if (!conversationId) return
    AsyncStorage.getItem(`${DRAFT_PREFIX}${conversationId}`).then((val) => {
      if (val) setDraftState(val)
    })
  }, [conversationId])

  const setDraft = useCallback(async (text: string) => {
    setDraftState(text)
    if (!conversationId) return
    if (text.trim()) {
      await AsyncStorage.setItem(`${DRAFT_PREFIX}${conversationId}`, text)
    } else {
      await AsyncStorage.removeItem(`${DRAFT_PREFIX}${conversationId}`)
    }
  }, [conversationId])

  const clearDraft = useCallback(async () => {
    setDraftState('')
    if (!conversationId) return
    await AsyncStorage.removeItem(`${DRAFT_PREFIX}${conversationId}`)
  }, [conversationId])

  return { draft, setDraft, clearDraft }
}
