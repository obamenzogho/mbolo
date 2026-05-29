import { useState, useEffect, useCallback, useRef } from 'react'
import { auth } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { generateSuggestions, getTrendingCreators } from '../services/recommendationService'
import { buildInterestProfile } from '../services/interestService'
import { clearSuggestionCache } from '../services/suggestionCache'
import type { FollowSuggestion, InterestProfile } from '../types'

interface UseFollowSuggestionsOptions {
  mode?: 'for_you' | 'trending'
  maxResults?: number
  autoRefresh?: boolean
}

interface UseFollowSuggestionsReturn {
  suggestions: FollowSuggestion[]
  trending: FollowSuggestion[]
  loading: boolean
  refreshing: boolean
  error: Error | null
  refresh: () => Promise<void>
  dismissSuggestion: (id: string) => void
  clearCache: () => Promise<void>
}

export function useFollowSuggestions(
  options: UseFollowSuggestionsOptions = {},
): UseFollowSuggestionsReturn {
  const { mode = 'for_you', maxResults = 50, autoRefresh = true } = options

  const [suggestions, setSuggestions] = useState<FollowSuggestion[]>([])
  const [trending, setTrending] = useState<FollowSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)
  const interestProfileRef = useRef<InterestProfile | null>(null)

  const fetch = useCallback(async (isRefresh: boolean = false) => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const profile = await buildInterestProfile(uid)
      interestProfileRef.current = profile

      const [all, trend] = await Promise.all([
        generateSuggestions(profile),
        getTrendingCreators(20),
      ])

      if (mountedRef.current) {
        setSuggestions(all.slice(0, maxResults))
        setTrending(trend)
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      captureException(err, { context: 'useFollowSuggestions' })
      if (mountedRef.current) setError(err)
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [maxResults])

  useEffect(() => {
    mountedRef.current = true
    if (autoRefresh) fetch(false)
    return () => { mountedRef.current = false }
  }, [autoRefresh, fetch])

  const refresh = useCallback(async () => {
    await fetch(true)
  }, [fetch])

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const clearCache = useCallback(async () => {
    const uid = auth.currentUser?.uid
    if (uid) {
      await clearSuggestionCache(uid)
      setSuggestions([])
      setLoading(true)
      await fetch(false)
    }
  }, [fetch])

  return {
    suggestions,
    trending,
    loading,
    refreshing,
    error,
    refresh,
    dismissSuggestion,
    clearCache,
  }
}
