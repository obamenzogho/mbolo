import { Image } from 'react-native'
import { VideoCache } from '@/features/feed/services/VideoCache'
import { captureException } from '@/lib/sentry'
import type { Video } from '@/types'

/** Précharge les 1res vidéos et renvoie l'URL de la miniature de la toute
 *  première (une fois son prefetch réseau terminé), pour l'afficher comme
 *  premier rendu du feed à la place du loader. Renvoie null si indisponible. */
export async function preloadFirstVideos(videos: Video[]): Promise<string | null> {
  if (videos.length === 0) return null

  try {
    const targets = videos.slice(0, 3)
    await Promise.allSettled(
      targets.map((v) =>
        VideoCache.get(v.id).catch(() => {
          /* fail silently per-video */
        }),
      ),
    )

    const prefetchTargets = targets
      .map((v) => v.thumbnailURL)
      .filter(Boolean) as string[]
    if (prefetchTargets.length > 0) {
      // On attend la fin du prefetch de la 1re miniature pour ne l'afficher
      // qu'une fois réellement en cache (pas de flash / d'image partielle).
      try { await Image.prefetch(prefetchTargets[0]) } catch { /* ignore */ }
      return prefetchTargets[0]
    }
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), { context: 'preloadFirstVideos' })
  }
  return null
}

export async function preloadVideoThumbnail(thumbnailURL: string): Promise<void> {
  if (!thumbnailURL) return
  try {
    Image.prefetch(thumbnailURL)
  } catch {
    /* silently fail */
  }
}
