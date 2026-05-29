import type { Video as VideoType } from '../types'

const WEIGHTS = {
  watchTime: 0.4,
  comments: 0.2,
  shares: 0.25,
  reposts: 0.05,
  likes: 0.1,
}

const RECENCY_DAYS_DECAY = 7

const FOLLOWED_USER_REPOST_BOOST = 50
const CLOSE_FRIEND_REPOST_BOOST = 100

const DM_SHARE_RATE_BOOST = 100
const EXTERNAL_SHARE_RATE_BOOST = 150
const SHARE_CONVERSION_BOOST = 200

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

  const recencyScore = Math.max(0, 1 - ageInDays / RECENCY_DAYS_DECAY)
  const likesScore = (video.likes || 0) / ((video.likes || 0) + 10)
  const commentsScore = (video.comments || 0) / ((video.comments || 0) + 5)
  const sharesScore = (video.shares || 0) / ((video.shares || 0) + 5)
  const repostsScore = (video.reposts || 0) / ((video.reposts || 0) + 5)
  const viewsScore = (video.views || 0) / ((video.views || 0) + 50)
  const watchTimeScore = Math.min(1, watchTimePercentage / 100)

  let score =
    watchTimeScore * WEIGHTS.watchTime
    + commentsScore * WEIGHTS.comments
    + sharesScore * WEIGHTS.shares
    + repostsScore * WEIGHTS.reposts
    + likesScore * WEIGHTS.likes
    + recencyScore * 0

  if (followedUserReposted) score += FOLLOWED_USER_REPOST_BOOST
  if (closeFriendReposted) score += CLOSE_FRIEND_REPOST_BOOST

  if (dmShareRate === 'high') score += DM_SHARE_RATE_BOOST
  if (externalShareRate === 'high') score += EXTERNAL_SHARE_RATE_BOOST
  if (shareConversionRate === 'high') score += SHARE_CONVERSION_BOOST

  return score
}