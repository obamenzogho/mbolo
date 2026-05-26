import type { Video as VideoType } from '../types'

const WEIGHTS = {
  likes: 0.3,
  comments: 0.2,
  shares: 0.1,
  views: 0.15,
  recency: 0.25,
}

const RECENCY_DAYS_DECAY = 7

export function scoreVideo(video: VideoType): number {
  const now = Date.now()
  const createdAtMs = (video.createdAt as any)?.seconds
    ? (video.createdAt as any).seconds * 1000
    : new Date(video.createdAt as any).getTime()
  const ageInDays = (now - createdAtMs) / (1000 * 60 * 60 * 24)

  const recencyScore = Math.max(0, 1 - ageInDays / RECENCY_DAYS_DECAY)
  const likesScore = (video.likes || 0) / (video.likes || 0 + 10)
  const commentsScore = (video.comments || 0) / (video.comments || 0 + 5)
  const sharesScore = (video.shares || 0) / (video.shares || 0 + 5)
  const viewsScore = (video.views || 0) / (video.views || 0 + 50)

  return (
    likesScore * WEIGHTS.likes
    + commentsScore * WEIGHTS.comments
    + sharesScore * WEIGHTS.shares
    + viewsScore * WEIGHTS.views
    + recencyScore * WEIGHTS.recency
  )
}