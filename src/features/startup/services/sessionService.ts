import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { captureException } from '@/lib/sentry'
import type { User } from '@/types'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SESSION_CACHE_KEY = '@mbolo_session_cache'

interface SessionCache {
  uid: string
  email: string | null
  cachedAt: number
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours
const TIMEOUT_WITH_CACHE_MS = 8000
const TIMEOUT_NO_CACHE_MS = 3000

export async function restoreSession(): Promise<{ user: User | null; uid: string | null }> {
  const cached = await getCachedSession()
  const hasValidCache = cached !== null && (Date.now() - cached.cachedAt) < SESSION_TTL_MS
  const timeoutMs = hasValidCache ? TIMEOUT_WITH_CACHE_MS : TIMEOUT_NO_CACHE_MS

  return new Promise((resolve) => {
    let resolved = false
    const timeout = setTimeout(() => {
      if (resolved) return
      resolved = true
      unsub()
      if (!hasValidCache) {
        AsyncStorage.removeItem(SESSION_CACHE_KEY).catch(() => {})
      }
      resolve({ user: null, uid: null })
    }, timeoutMs)

    const unsub = onAuthStateChanged(auth, async (firebaseUser: any) => {
      if (resolved) return

      if (!firebaseUser) return

      resolved = true
      clearTimeout(timeout)
      unsub()

      const uid = firebaseUser.uid
      try {
        const userDoc = await getDoc(doc(db, 'users', uid))
        if (userDoc.exists()) {
          const userData = { id: uid, ...userDoc.data() } as unknown as User
          const cache: SessionCache = { uid, email: firebaseUser.email, cachedAt: Date.now() }
          await AsyncStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cache))
          resolve({ user: userData, uid })
        } else {
          resolve({ user: null, uid })
        }
      } catch (err) {
        captureException(err instanceof Error ? err : new Error(String(err)), { context: 'restoreSession' })
        resolve({ user: null, uid })
      }
    })
  })
}

export async function getCachedSession(): Promise<SessionCache | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionCache
  } catch {
    return null
  }
}
