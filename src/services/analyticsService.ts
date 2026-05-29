import { auth } from '../lib/firebase'

type AnalyticsEvent =
  | { type: 'video_watch_time'; videoId: string; percentageWatched: number; timestamp: number; userId?: string }
  | { type: 'repost'; videoId: string; action: 'add' | 'remove'; timestamp: number; userId?: string }
  | { type: 'repost_impact'; videoId: string; repostCount: number; watchTimeImpact: number; timestamp: number }
  | { type: 'share'; videoId: string; shareType: string; timestamp: number; userId?: string }
  | { type: 'share_dm'; videoId: string; receiverId: string; timestamp: number; userId?: string }
  | { type: 'share_copy_link'; videoId: string; timestamp: number; userId?: string }
  | { type: 'share_external'; videoId: string; platform: string; timestamp: number; userId?: string }

const eventBuffer: AnalyticsEvent[] = []

export function trackWatchTime(videoId: string, percentageWatched: number): void {
  const event: AnalyticsEvent = {
    type: 'video_watch_time',
    videoId,
    percentageWatched: Math.round(percentageWatched * 10000) / 100,
    timestamp: Date.now(),
    userId: auth.currentUser?.uid,
  }
  eventBuffer.push(event)
  console.warn('[Analytics] video_watch_time', event)
}

export function trackRepost(videoId: string, action: 'add' | 'remove'): void {
  const event: AnalyticsEvent = {
    type: 'repost',
    videoId,
    action,
    timestamp: Date.now(),
    userId: auth.currentUser?.uid,
  }
  eventBuffer.push(event)
  console.warn('[Analytics] repost', event)
}

export function trackRepostImpact(videoId: string, repostCount: number, watchTimeImpact: number): void {
  const event: AnalyticsEvent = {
    type: 'repost_impact',
    videoId,
    repostCount,
    watchTimeImpact,
    timestamp: Date.now(),
  }
  eventBuffer.push(event)
}

export function getAnalyticsEvents(): readonly AnalyticsEvent[] {
  return eventBuffer
}

export function flushAnalyticsEvents(): AnalyticsEvent[] {
  return eventBuffer.splice(0, eventBuffer.length)
}
