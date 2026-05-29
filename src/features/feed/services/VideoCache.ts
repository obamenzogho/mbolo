/* VideoCache — cache 2 niveaux pour les données vidéo.
   Rôle : L1 RAM (Map, max 5, LRU) + L2 AsyncStorage (max 500MB, LRU).
   warm() au mount pour charger les métadonnées des 10 dernières vidéos en L1. */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { FEED_DEBUG } from '../store/feedStore'

const L2_PREFIX = '@mbolo_videocache_'
const L2_INDEX_KEY = '@mbolo_videocache_index'
const L2_MAX_BYTES = 500 * 1024 * 1024

interface CacheEntry {
  blobUri?: string
  firstFrame?: string
  meta?: string
  size: number
  accessedAt: number
}

const L1_MAX = 5
const l1Cache = new Map<string, CacheEntry>()
const l1AccessOrder: string[] = []

function updateAccessOrder(key: string) {
  const idx = l1AccessOrder.indexOf(key)
  if (idx !== -1) l1AccessOrder.splice(idx, 1)
  l1AccessOrder.push(key)
}

function evictL1IfNeeded() {
  while (l1Cache.size >= L1_MAX && l1AccessOrder.length > 0) {
    const oldest = l1AccessOrder.shift()
    if (oldest && l1Cache.has(oldest)) {
      const entry = l1Cache.get(oldest)!
      l1Cache.delete(oldest)
      AsyncStorage.setItem(L2_PREFIX + oldest, JSON.stringify(entry)).catch(() => {})
      if (FEED_DEBUG) console.log('[FEED_DEBUG] CACHE: L1 evict → L2', oldest)
    }
  }
}

interface L2IndexEntry {
  key: string
  size: number
  accessedAt: number
}

async function getL2Index(): Promise<L2IndexEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(L2_INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function saveL2Index(index: L2IndexEntry[]) {
  await AsyncStorage.setItem(L2_INDEX_KEY, JSON.stringify(index))
}

async function evictL2IfNeeded(additionalBytes: number = 0) {
  const index = await getL2Index()
  let totalBytes = index.reduce((sum, e) => sum + e.size, 0) + additionalBytes

  if (totalBytes <= L2_MAX_BYTES) return

  index.sort((a, b) => a.accessedAt - b.accessedAt)
  while (index.length > 0 && totalBytes > L2_MAX_BYTES) {
    const oldest = index.shift()!
    try {
      await AsyncStorage.removeItem(L2_PREFIX + oldest.key)
    } catch {}
    totalBytes -= oldest.size
    if (FEED_DEBUG) console.log('[FEED_DEBUG] CACHE: L2 evict', oldest.key)
  }

  await saveL2Index(index)
}

let warmStarted = false

export const VideoCache = {
  async get(key: string): Promise<CacheEntry | null> {
    const l1 = l1Cache.get(key)
    if (l1) {
      l1.accessedAt = Date.now()
      updateAccessOrder(key)
      if (FEED_DEBUG) console.log('[FEED_DEBUG] CACHE: HIT L1', key)
      return l1
    }

    try {
      const raw = await AsyncStorage.getItem(L2_PREFIX + key)
      if (raw) {
        const entry: CacheEntry = JSON.parse(raw)
        entry.accessedAt = Date.now()
        l1Cache.set(key, entry)
        updateAccessOrder(key)
        evictL1IfNeeded()
        if (FEED_DEBUG) console.log('[FEED_DEBUG] CACHE: HIT L2', key)
        return entry
      }
    } catch {}

    if (FEED_DEBUG) console.log('[FEED_DEBUG] CACHE: MISS', key)
    return null
  },

  async set(key: string, data: { blobUri?: string; firstFrame?: string; meta?: string }, size: number = 0) {
    const now = Date.now()
    const entry: CacheEntry = { ...data, size, accessedAt: now }

    l1Cache.set(key, entry)
    updateAccessOrder(key)
    evictL1IfNeeded()

    const index = await getL2Index()
    const existing = index.find((e) => e.key === key)
    if (existing) {
      existing.size = size
      existing.accessedAt = now
    } else {
      index.push({ key, size, accessedAt: now })
    }
    await saveL2Index(index)
    await AsyncStorage.setItem(L2_PREFIX + key, JSON.stringify(entry))
    await evictL2IfNeeded()

    if (FEED_DEBUG) console.log('[FEED_DEBUG] CACHE: set', key)
  },

  async has(key: string): Promise<boolean> {
    if (l1Cache.has(key)) return true
    try {
      const raw = await AsyncStorage.getItem(L2_PREFIX + key)
      return raw !== null
    } catch {
      return false
    }
  },

  async evict(key: string) {
    l1Cache.delete(key)
    const idx = l1AccessOrder.indexOf(key)
    if (idx !== -1) l1AccessOrder.splice(idx, 1)
    try {
      await AsyncStorage.removeItem(L2_PREFIX + key)
      const index = await getL2Index()
      const filtered = index.filter((e) => e.key !== key)
      await saveL2Index(filtered)
    } catch {}
  },

  async clear() {
    l1Cache.clear()
    l1AccessOrder.length = 0
    try {
      const index = await getL2Index()
      await Promise.all(index.map((e) => AsyncStorage.removeItem(L2_PREFIX + e.key)))
      await AsyncStorage.removeItem(L2_INDEX_KEY)
    } catch {}
  },

  async warm() {
    if (warmStarted) {
      if (FEED_DEBUG) console.log('[FEED_DEBUG] CACHE: warm already started, skip')
      return
    }
    warmStarted = true
    if (FEED_DEBUG) console.log('[FEED_DEBUG] CACHE: warm start')
    try {
      const index = await getL2Index()
      const recent = index.sort((a, b) => b.accessedAt - a.accessedAt).slice(0, 10)
      for (const entry of recent) {
        if (!l1Cache.has(entry.key)) {
          const raw = await AsyncStorage.getItem(L2_PREFIX + entry.key)
          if (raw) {
            const parsed: CacheEntry = JSON.parse(raw)
            l1Cache.set(entry.key, { ...parsed })
            updateAccessOrder(entry.key)
            evictL1IfNeeded()
          }
        }
      }
    } catch {}
    if (FEED_DEBUG) console.log('[FEED_DEBUG] CACHE: warm done')
  },
}
