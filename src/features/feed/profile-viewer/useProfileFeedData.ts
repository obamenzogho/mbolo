/* useProfileFeedData — adapte les données props (videos + initialIndex)
   au format attendu par VideoPlayerPool et les hooks de visibilité.
   Gère un currentIndex LOCAL (pas le feedStore global) car ProfileVideoViewer
   peut être monté en même temps que FeedScreen.
   skipToNext: incrémente l'index local (ne touche pas au feedStore). */

import { useState, useEffect, useCallback } from 'react'
import type { Video } from '../../../types'

export interface UseProfileFeedDataProps {
  videos: Video[]
  initialIndex: number
}

export interface UseProfileFeedDataResult {
  videos: Video[]
  currentIndex: number
  setCurrentIndex: (i: number) => void
  isLoadingMore: false
  hasMore: false
  skipToNext: (failedVideoId?: string) => void
}

export function useProfileFeedData({
  videos,
  initialIndex,
}: UseProfileFeedDataProps): UseProfileFeedDataResult {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => {
    if (videos.length > 0 && currentIndex >= videos.length) {
      setCurrentIndex(0)
    }
  }, [videos.length, currentIndex])

  const skipToNext = useCallback(
    (failedVideoId?: string) => {
      setCurrentIndex((i) => Math.min(i + 1, videos.length - 1))
    },
    [videos.length],
  )

  return {
    videos,
    currentIndex,
    setCurrentIndex,
    skipToNext,
    isLoadingMore: false as const,
    hasMore: false as const,
  }
}
