import { auth } from '../../../lib/firebase'

type FeedAction = 'swipe' | 'like' | 'comment' | 'share' | 'save' | 'view' | 'rewatch'

interface FeedEvent {
  action: FeedAction
  videoId: string
  timestamp: number
  timeSpent?: number
  position?: number
  sessionId?: string
}

let sessionId = ''
let eventBuffer: FeedEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
const FLUSH_INTERVAL = 30000

function getSessionId(): string {
  if (!sessionId) sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return sessionId
}

function flush(): void {
  if (eventBuffer.length === 0) return
  const batch = eventBuffer.splice(0, eventBuffer.length)
  const user = auth.currentUser
  if (!user) return
  try {
    fetch('/api/analytics/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.uid, events: batch, sessionId: getSessionId() }),
      keepalive: true,
    }).catch(() => {})
  } catch {}
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
    scheduleFlush()
  }, FLUSH_INTERVAL)
}

export function trackFeedEvent(action: FeedAction, videoId: string, extra?: Partial<FeedEvent>): void {
  const event: FeedEvent = {
    action,
    videoId,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    ...extra,
  }
  eventBuffer.push(event)
  scheduleFlush()
}

export function trackSwipe(fromIndex: number, toIndex: number, timeSpent: number): void {
  trackFeedEvent('swipe', `${fromIndex}->${toIndex}`, { timeSpent })
}

export function trackViewTime(videoId: string, timeSpent: number): void {
  trackFeedEvent('view', videoId, { timeSpent })
}

export function flushAnalytics(): void {
  flush()
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
}
