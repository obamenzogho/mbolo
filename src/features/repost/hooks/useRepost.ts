import { useState, useCallback } from 'react'
import { auth } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { trackRepost } from '@/services/analyticsService'
import { toggleRepost } from '../services/repostService'
import * as Haptics from 'expo-haptics'
import type { Video } from '@/types'

interface UseRepostOptions {
  video: Video
  onSuccess?: (reposted: boolean) => void
  onError?: (error: Error) => void
}

export function useRepost({ video, onSuccess, onError }: UseRepostOptions) {
  const currentUserId = auth.currentUser?.uid ?? ''
  const [reposted, setReposted] = useState(
    video.repostedBy?.includes(currentUserId) ?? false,
  )
  const [repostCount, setRepostCount] = useState(video.reposts ?? 0)
  const [loading, setLoading] = useState(false)

  const handleRepost = useCallback(async () => {
    const user = auth.currentUser
    if (!user || loading) return
    setLoading(true)

    const wasReposted = reposted
    setReposted(!wasReposted)
    setRepostCount((p) => (wasReposted ? Math.max(0, p - 1) : p + 1))

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const result = await toggleRepost(
        video.id,
        user.uid,
        video.userId,
      )
      setReposted(result.reposted)
      trackRepost(video.id, result.reposted ? 'add' : 'remove')
      onSuccess?.(result.reposted)
    } catch (e) {
      setReposted(wasReposted)
      setRepostCount((p) => (wasReposted ? p + 1 : Math.max(0, p - 1)))
      const error = e instanceof Error ? e : new Error(String(e))
      captureException(error, { context: 'useRepost' })
      onError?.(error)
    }
    setLoading(false)
  }, [video.id, video.userId, reposted, loading, onSuccess, onError])

  return {
    reposted,
    repostCount,
    loading,
    toggleRepost: handleRepost,
  }
}
