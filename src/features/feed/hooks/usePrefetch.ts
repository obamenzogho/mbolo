import { useEffect, useRef } from 'react'
import { useFeedStore, FEED_DEBUG } from '../store/feedStore'
import { PrefetchQueue } from '../services/PrefetchQueue'
import { VideoCache } from '../services/VideoCache'
import { resolveVideoUrl } from '../services/resolveVideoUrl'
import type { Video } from '../../../types'

const prefetchedCache = new Set<string>()
const SCROLL_SPEED_THRESHOLD = 3

async function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const race = Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms)
    }),
  ]) as Promise<T>
  try {
    const result = await race
    clearTimeout(timer!)
    return result
  } catch (e) {
    clearTimeout(timer!)
    throw e
  }
}

async function extractAndCacheFirstFrame(video: Video) {
  const uri = resolveVideoUrl(video)
  try {
    const { getThumbnailAsync } = await import('expo-video-thumbnails')
    const result = await timeout(getThumbnailAsync(uri, { time: 0 }), 500)
    await VideoCache.set(video.id, { firstFrame: result.uri }, 0)
    if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: first frame cached', video.id)
  } catch {
    if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: first frame fallback (timeout/error)', video.id)
  }
}

export function usePrefetch(videos: Video[], customIndex: number = 0, isActive: boolean = true) {
  // On ne s'abonne PAS à currentIndex du store (haute fréquence pendant le
  // scroll → re-render des 3 feeds pré-montés). L'index est fourni par
  // l'appelant. Seul networkQuality (basse fréquence) reste observé.
  const networkQuality = useFeedStore((s) => s.networkQuality)
  const currentIndex = customIndex
  const lastIndexRef = useRef(currentIndex)
  const scrollSpeedRef = useRef(0)

  useEffect(() => {
    const now = Date.now()
    const elapsed = now - lastIndexRef.current
    const delta = Math.abs(currentIndex - lastIndexRef.current)

    if (elapsed > 0 && delta > 0) {
      const instantSpeed = delta / (elapsed / 1000)
      scrollSpeedRef.current = scrollSpeedRef.current * 0.7 + instantSpeed * 0.3
    }

    lastIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    // Un feed inactif (onglet non visible) ne préfetch rien : inutile de
    // télécharger + extraire des first-frames pour un écran qu'on ne regarde pas.
    if (!isActive) return
    if (videos.length === 0) return

    const isFastScrolling = scrollSpeedRef.current > SCROLL_SPEED_THRESHOLD

    const priorities: [number, 1 | 2 | 3][] = [
      [1, 3],
      [2, 2],
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 1],
    ]

    for (const [offset, priority] of priorities) {
      if (isFastScrolling && priority < 3) continue

      const idx = currentIndex + offset
      if (idx >= 0 && idx < videos.length) {
        const video = videos[idx]
        if (!prefetchedCache.has(video.id)) {
          const uri = resolveVideoUrl(video)
          PrefetchQueue.enqueue(video.id, uri, priority)
          prefetchedCache.add(video.id)
          if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: enqueue', video.id, 'priority:', priority)

          if (priority === 3) {
            extractAndCacheFirstFrame(video)
          }
        }
      }
    }

    const cancelMin = Math.max(0, currentIndex - 3)
    for (const videoId of prefetchedCache) {
      const idx = videos.findIndex((v) => v.id === videoId)
      if (idx === -1 || idx < cancelMin || idx > currentIndex + 6) {
        PrefetchQueue.cancel(videoId)
        prefetchedCache.delete(videoId)
        if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: cancel', videoId)
      }
    }
  }, [currentIndex, isActive, videos, networkQuality])
}
