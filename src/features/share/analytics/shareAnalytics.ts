import type { ShareType } from '../types'

type ShareAnalyticsEvent = {
  videoId: string
  shareType: ShareType
  senderId: string
  receiverId?: string
  timestamp: number
}

const shareEventBuffer: ShareAnalyticsEvent[] = []

export function trackShareEvent(event: Omit<ShareAnalyticsEvent, 'timestamp'>): void {
  const fullEvent: ShareAnalyticsEvent = {
    ...event,
    timestamp: Date.now(),
  }
  shareEventBuffer.push(fullEvent)
  console.warn('[ShareAnalytics] share', event.shareType, event.videoId)
}

export function getShareEvents(): readonly ShareAnalyticsEvent[] {
  return shareEventBuffer
}

export function flushShareEvents(): ShareAnalyticsEvent[] {
  return shareEventBuffer.splice(0, shareEventBuffer.length)
}
