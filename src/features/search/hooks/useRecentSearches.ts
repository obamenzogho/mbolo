import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@mbolo_recent_searches'
const MAX_RECENT = 8

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setRecent(JSON.parse(raw))
    })
  }, [])

  const addSearch = useCallback(async (term: string) => {
    const trimmed = term.trim()
    if (!trimmed) return
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, MAX_RECENT)
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeSearch = useCallback(async (term: string) => {
    setRecent((prev) => {
      const next = prev.filter((s) => s !== term)
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const clearRecent = useCallback(async () => {
    setRecent([])
    AsyncStorage.removeItem(STORAGE_KEY)
  }, [])

  return { recent, addSearch, removeSearch, clearRecent }
}
