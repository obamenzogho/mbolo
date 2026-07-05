import AsyncStorage from '@react-native-async-storage/async-storage'
import { doc, setDoc } from 'firebase/firestore'
import { db, auth } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'

const CACHE_KEY = 'mbolo:watchRatios'
let cache: Record<string, number> = {}
let loaded = false

export async function loadWatchCache(): Promise<Record<string, number>> {
  if (loaded) return cache
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    cache = raw ? JSON.parse(raw) : {}
  } catch { cache = {} }
  loaded = true
  return cache
}

export async function recordWatch(videoId: string, ratio: number, replayed = false) {
  const clamped = Math.max(0, Math.min(1, ratio))
  const prev = cache[videoId] ?? 0
  const score = Math.max(prev, clamped) + (replayed ? 0.3 : 0)
  cache[videoId] = Math.min(1.5, score)

  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => {})

  const uid = auth.currentUser?.uid
  if (uid && (clamped > 0.25 || replayed)) {
    setDoc(
      doc(db, 'users', uid, 'watched', videoId),
      { ratio: cache[videoId], updatedAt: Date.now() },
      { merge: true }
    ).catch((e) => captureException(e instanceof Error ? e : new Error(String(e)), { context: 'recordWatch' }))
  }
}

export function getWatchCache(): Record<string, number> {
  return cache
}
