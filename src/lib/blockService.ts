import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from './firebase'
import { captureException } from './sentry'

let blockedUsersCache: Set<string> | null = null
let blockedUsersCacheTimestamp = 0
const CACHE_TTL = 300000

export async function getBlockedUserIds(): Promise<Set<string>> {
  const now = Date.now()
  if (blockedUsersCache && now - blockedUsersCacheTimestamp < CACHE_TTL) {
    return blockedUsersCache
  }

  const currentUid = auth.currentUser?.uid
  if (!currentUid) {
    blockedUsersCache = new Set()
    return blockedUsersCache
  }

  try {
    const snap = await getDoc(doc(db, 'users', currentUid))
    if (snap.exists()) {
      const blocked = snap.data()?.blocked || []
      blockedUsersCache = new Set(blocked)
      blockedUsersCacheTimestamp = now
      return blockedUsersCache
    }
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getBlockedUserIds' })
  }

  blockedUsersCache = new Set()
  return blockedUsersCache
}

export function clearBlockedUsersCache() {
  blockedUsersCache = null
  blockedUsersCacheTimestamp = 0
}
