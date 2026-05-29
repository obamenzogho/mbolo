import { Image } from 'react-native'
import { VideoCache } from '@/features/feed/services/VideoCache'
import { captureException } from '@/lib/sentry'
import type { Video } from '@/types'

export async function preloadFirstVideos(videos: Video[]) {
  if (videos.length === 0) return

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
      Image.prefetch(prefetchTargets[0])
    }
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), { context: 'preloadFirstVideos' })
  }
}

export async function preloadVideoThumbnail(thumbnailURL: string): Promise<void> {
  if (!thumbnailURL) return
  try {
    Image.prefetch(thumbnailURL)
  } catch {
    /* silently fail */
  }
}
