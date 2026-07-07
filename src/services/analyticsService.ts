import { AppState } from 'react-native'
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { captureException } from '../lib/sentry'

type AnalyticsEvent =
  | { type: 'video_watch_time'; videoId: string; percentageWatched: number; timestamp: number; userId?: string }
  | { type: 'repost'; videoId: string; action: 'add' | 'remove'; timestamp: number; userId?: string }
  | { type: 'repost_impact'; videoId: string; repostCount: number; watchTimeImpact: number; timestamp: number }
  | { type: 'share'; videoId: string; shareType: string; timestamp: number; userId?: string }
  | { type: 'share_dm'; videoId: string; receiverId: string; timestamp: number; userId?: string }
  | { type: 'share_copy_link'; videoId: string; timestamp: number; userId?: string }
  | { type: 'share_external'; videoId: string; platform: string; timestamp: number; userId?: string }

const eventBuffer: AnalyticsEvent[] = []
const FLUSH_THRESHOLD = 20
const FLUSH_INTERVAL_MS = 30_000
let flushing = false

async function flush(): Promise<void> {
  if (flushing || eventBuffer.length === 0) return
  flushing = true
  const batchEvents = eventBuffer.splice(0, eventBuffer.length)
  try {
    for (let i = 0; i < batchEvents.length; i += 450) {
      const chunk = batchEvents.slice(i, i + 450)
      const batch = writeBatch(db)
      for (const ev of chunk) {
        batch.set(doc(collection(db, 'analytics_events')), { ...ev, receivedAt: serverTimestamp() })
      }
      await batch.commit()
    }
  } catch (e) {
    eventBuffer.unshift(...batchEvents)
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'analytics.flush' })
  } finally {
    flushing = false
  }
}

function enqueue(event: AnalyticsEvent): void {
  eventBuffer.push(event)
  if (eventBuffer.length >= FLUSH_THRESHOLD) void flush()
}

let started = false
export function initAnalytics(): void {
  if (started) return
  started = true
  setInterval(() => void flush(), FLUSH_INTERVAL_MS)
  AppState.addEventListener('change', (s) => { if (s === 'background') void flush() })
}

export function trackWatchTime(videoId: string, percentageWatched: number): void {
  enqueue({
    type: 'video_watch_time', videoId,
    percentageWatched: Math.round(percentageWatched * 10000) / 100,
    timestamp: Date.now(), userId: auth.currentUser?.uid,
  })
}

export function trackRepost(videoId: string, action: 'add' | 'remove'): void {
  enqueue({ type: 'repost', videoId, action, timestamp: Date.now(), userId: auth.currentUser?.uid })
}

export function trackRepostImpact(videoId: string, repostCount: number, watchTimeImpact: number): void {
  enqueue({ type: 'repost_impact', videoId, repostCount, watchTimeImpact, timestamp: Date.now() })
}

export function trackShare(videoId: string, shareType: string): void {
  enqueue({ type: 'share', videoId, shareType, timestamp: Date.now(), userId: auth.currentUser?.uid })
}

export function getAnalyticsEvents(): readonly AnalyticsEvent[] {
  return eventBuffer
}

export function flushAnalyticsEvents(): Promise<void> {
  return flush()
}
