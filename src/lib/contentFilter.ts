import { getBlockedUserIds } from './blockService'
import type { Video as VideoType } from '../types'

export async function filterVideos(videos: VideoType[]): Promise<VideoType[]> {
  const blocked = await getBlockedUserIds()
  return videos.filter((v) => {
    if ((v as any).moderationStatus === 'hidden') return false
    if (v.userId && blocked.has(v.userId)) return false
    return true
  })
}

export function filterVideosSync(videos: VideoType[], blocked: Set<string>): VideoType[] {
  return videos.filter(
    (v) => (v as any).moderationStatus !== 'hidden' && !(v.userId && blocked.has(v.userId)),
  )
}
