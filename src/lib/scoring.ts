import type { Video as VideoType } from '../types'

const WEIGHTS = {
  watchTime: 0.4,
  comments: 0.2,
  shares: 0.25,
  reposts: 0.05,
  likes: 0.1,
}

const RECENCY_DAYS_DECAY = 7
const RECENCY_FLOOR = 0.3

const FOLLOWED_USER_REPOST_BOOST = 0.15
const CLOSE_FRIEND_REPOST_BOOST = 0.30
const DM_SHARE_RATE_BOOST = 0.10
const EXTERNAL_SHARE_RATE_BOOST = 0.15
const SHARE_CONVERSION_BOOST = 0.20

interface ScoreOptions {
  video: VideoType
  followedUserReposted?: boolean
  closeFriendReposted?: boolean
  watchTimePercentage?: number
  dmShareRate?: 'low' | 'medium' | 'high'
  externalShareRate?: 'low' | 'medium' | 'high'
  shareConversionRate?: 'low' | 'medium' | 'high'
}

export function scoreVideo(video: VideoType): number {
  return scoreVideoWithOptions({ video })
}

export function scoreVideoWithOptions({
  video,
  followedUserReposted = false,
  closeFriendReposted = false,
  watchTimePercentage = 0,
  dmShareRate,
  externalShareRate,
  shareConversionRate,
}: ScoreOptions): number {
  const now = Date.now()
  const createdAtMs = (video.createdAt as any)?.seconds
    ? (video.createdAt as any).seconds * 1000
    : new Date(video.createdAt as any).getTime()
  const ageInDays = (now - createdAtMs) / (1000 * 60 * 60 * 24)

  const recencyMultiplier = Math.max(
    RECENCY_FLOOR,
    1 - (ageInDays / RECENCY_DAYS_DECAY) * (1 - RECENCY_FLOOR),
  )

  const likesScore = (video.likes || 0) / ((video.likes || 0) + 10)
  const commentsScore = (video.comments || 0) / ((video.comments || 0) + 5)
  const sharesScore = (video.shares || 0) / ((video.shares || 0) + 5)
  const repostsScore = (video.reposts || 0) / ((video.reposts || 0) + 5)
  const watchTimeScore = Math.min(1, watchTimePercentage / 100)

  const engagement =
    watchTimeScore * WEIGHTS.watchTime +
    commentsScore * WEIGHTS.comments +
    sharesScore * WEIGHTS.shares +
    repostsScore * WEIGHTS.reposts +
    likesScore * WEIGHTS.likes

  let score = engagement * recencyMultiplier

  if (closeFriendReposted) score += CLOSE_FRIEND_REPOST_BOOST
  else if (followedUserReposted) score += FOLLOWED_USER_REPOST_BOOST

  if (dmShareRate === 'high') score += DM_SHARE_RATE_BOOST
  if (externalShareRate === 'high') score += EXTERNAL_SHARE_RATE_BOOST
  if (shareConversionRate === 'high') score += SHARE_CONVERSION_BOOST

  return score
}