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
  // Sens du scroll : +1 vers le bas (défaut), -1 vers le haut. Sert à préfetcher
  // dans la direction où l'utilisateur va réellement, façon TikTok/IG.
  const directionRef = useRef<1 | -1>(1)

  useEffect(() => {
    const now = Date.now()
    const elapsed = now - lastIndexRef.current
    const delta = Math.abs(currentIndex - lastIndexRef.current)

    if (elapsed > 0 && delta > 0) {
      const instantSpeed = delta / (elapsed / 1000)
      scrollSpeedRef.current = scrollSpeedRef.current * 0.7 + instantSpeed * 0.3
    }
    if (currentIndex > lastIndexRef.current) directionRef.current = 1
    else if (currentIndex < lastIndexRef.current) directionRef.current = -1

    lastIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    // Un feed inactif (onglet non visible) ne préfetch rien : inutile de
    // télécharger + extraire des first-frames pour un écran qu'on ne regarde pas.
    if (!isActive) return
    if (videos.length === 0) return

    const isFastScrolling = scrollSpeedRef.current > SCROLL_SPEED_THRESHOLD
    const dir = directionRef.current

    // Profondeur de préchargement adaptée au réseau (façon TikTok : on charge
    // loin quand le débit le permet, on se restreint aux 2 prochaines en réseau
    // lent pour ne pas saturer la bande passante du CURRENT).
    const depth = networkQuality === 'FAST' ? 6 : networkQuality === 'MEDIUM' ? 4 : 2

    // Fenêtre orientée : d'abord dans le sens du scroll (priorités hautes),
    // puis 1 cran dans le sens opposé (retour arrière fluide).
    const priorities: [number, 1 | 2 | 3][] = []
    for (let i = 1; i <= depth; i++) {
      const priority: 1 | 2 | 3 = i === 1 ? 3 : i === 2 ? 2 : 1
      priorities.push([dir * i, priority])
    }
    // Un cran dans le sens inverse (léger), pour un demi-tour immédiat.
    priorities.push([-dir, 1])

    for (const [offset, priority] of priorities) {
      if (isFastScrolling && priority < 3) continue

      const idx = currentIndex + offset
      if (idx >= 0 && idx < videos.length) {
        const video = videos[idx]
        if (!prefetchedCache.has(video.id)) {
          const uri = resolveVideoUrl(video)
          PrefetchQueue.enqueue(video.id, uri, priority)
          prefetchedCache.add(video.id)
          if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: enqueue', video.id, 'priority:', priority, 'dir:', dir)

          if (priority === 3) {
            extractAndCacheFirstFrame(video)
          }
        }
      }
    }

    // Nettoyage : on annule tout ce qui sort de la fenêtre utile [−3, +depth+1]
    // autour du CURRENT, quel que soit le sens.
    const cancelMin = Math.max(0, currentIndex - Math.max(3, depth))
    const cancelMax = currentIndex + depth + 1
    for (const videoId of prefetchedCache) {
      const idx = videos.findIndex((v) => v.id === videoId)
      if (idx === -1 || idx < cancelMin || idx > cancelMax) {
        PrefetchQueue.cancel(videoId)
        prefetchedCache.delete(videoId)
        if (FEED_DEBUG) console.log('[FEED_DEBUG] PREFETCH: cancel', videoId)
      }
    }
  }, [currentIndex, isActive, videos, networkQuality])
}
