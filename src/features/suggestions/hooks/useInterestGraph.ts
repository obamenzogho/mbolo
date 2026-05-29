import { useState, useEffect, useCallback, useRef } from 'react'
import { auth } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { buildInterestProfile } from '../services/interestService'
import type { InterestProfile, UserInterest } from '../types'

interface UseInterestGraphReturn {
  profile: InterestProfile | null
  loading: boolean
  error: Error | null
  topInterests: UserInterest[]
  topHashtags: string[]
  topCategories: string[]
  refresh: () => Promise<void>
}

export function useInterestGraph(): UseInterestGraphReturn {
  const [profile, setProfile] = useState<InterestProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  const fetch = useCallback(async () => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await buildInterestProfile(uid)
      if (mountedRef.current) setProfile(result)
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      captureException(err, { context: 'useInterestGraph' })
      if (mountedRef.current) setError(err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetch()
    return () => { mountedRef.current = false }
  }, [fetch])

  const refresh = useCallback(async () => {
    await fetch()
  }, [fetch])

  const sortedInterests = profile?.interests
    ? [...profile.interests].sort((a, b) => b.weight - a.weight)
    : []

  return {
    profile,
    loading,
    error,
    topInterests: sortedInterests.slice(0, 10),
    topHashtags: profile?.topHashtags || [],
    topCategories: profile?.topCategories || [],
    refresh,
  }
}
