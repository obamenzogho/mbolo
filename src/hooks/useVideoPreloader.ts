import { useEffect, useRef, useCallback } from 'react'

export function useVideoPreloader(videos: any[], currentIndex: number) {
  const preloadedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!videos.length) return

    const toPreload = [currentIndex + 1, currentIndex + 2]
    for (const idx of toPreload) {
      const video = videos[idx]
      if (!video || video.id.startsWith('demo-')) continue
      preloadedRef.current.add(video.id)
    }

    for (let i = 0; i <= currentIndex - 3; i++) {
      const video = videos[i]
      if (video) preloadedRef.current.delete(video.id)
    }
  }, [currentIndex, videos])

  const getPreloadedVideo = useCallback((index: number): { id: string; uri: string; preloaded: boolean } | null => {
    const video = videos[index]
    if (!video) return null
    return {
      id: video.id,
      uri: video.videoURL,
      preloaded: preloadedRef.current.has(video.id),
    }
  }, [videos])

  return { getPreloadedVideo }
}
