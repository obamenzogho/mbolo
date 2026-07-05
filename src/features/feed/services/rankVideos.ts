import type { Video } from '../../../types'

export interface UserTaste {
  likedHashtags: Record<string, number>
  likedCreators: Record<string, number>
  watchedRatio: Record<string, number>
}

export const EMPTY_TASTE: UserTaste = { likedHashtags: {}, likedCreators: {}, watchedRatio: {} }

const HOUR = 1000 * 60 * 60
const MIN_GAP = 3

export function scoreVideo(v: Video, taste: UserTaste, now = Date.now()): number {
  const engagement =
    Math.log1p(v.likes ?? 0) * 1.0 +
    Math.log1p(v.comments ?? 0) * 1.5 +
    Math.log1p(v.shares ?? 0) * 2.0 +
    Math.log1p(v.saves ?? 0) * 1.8

  const ageHours = Math.max(0, (now - new Date(v.createdAt).getTime()) / HOUR)
  const freshness = Math.exp(-ageHours / 36)

  let affinity = 0
  for (const tag of v.hashtags ?? []) affinity += taste.likedHashtags[tag] ?? 0
  affinity += (taste.likedCreators[v.userId] ?? 0) * 2

  const quality = taste.watchedRatio[v.id] ?? 0.5

  return engagement * 1.0 + freshness * 4.0 + affinity * 3.0 + quality * 2.0
}

function diversify(sorted: Video[], minGap = MIN_GAP, recentCreators: string[] = []): Video[] {
  const result: Video[] = []
  const lastSeenAt: Record<string, number> = {}
  recentCreators.forEach((uid, i) => {
    lastSeenAt[uid] = -(recentCreators.length - i)
  })
  const pending: Video[] = []

  const canPlace = (v: Video): boolean => {
    const last = lastSeenAt[v.userId]
    return last === undefined || result.length - last > minGap
  }

  const queue = [...sorted]
  while (queue.length > 0 || pending.length > 0) {
    const readyIdx = pending.findIndex(canPlace)
    if (readyIdx !== -1) {
      const v = pending.splice(readyIdx, 1)[0]
      lastSeenAt[v.userId] = result.length
      result.push(v)
      continue
    }
    if (queue.length > 0) {
      const v = queue.shift()!
      if (canPlace(v)) {
        lastSeenAt[v.userId] = result.length
        result.push(v)
      } else {
        pending.push(v)
      }
      continue
    }
    const v = pending.shift()!
    lastSeenAt[v.userId] = result.length
    result.push(v)
  }
  return result
}

export function rankVideos(
  videos: Video[],
  taste: UserTaste,
  recentCreators: string[] = []
): Video[] {
  const now = Date.now()
  const scored = [...videos]
    .map((v) => ({ v, s: scoreVideo(v, taste, now) * (0.92 + Math.random() * 0.16) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v)

  return diversify(scored, MIN_GAP, recentCreators)
}
