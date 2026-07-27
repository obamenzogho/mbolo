/**
 * searchCache.ts — Cache LRU simple pour les résultats de recherche Typesense.
 *
 * Évite de relancer la même requête si l'utilisateur tape annule + revient au même terme.
 * TTL de 30 secondes par entry, max 50 entrées.
 */

const TTL_MS = 30_000
const MAX_ENTRIES = 50

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<any>>()

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  // LRU : remettre en tête
  cache.delete(key)
  cache.set(key, entry)
  return entry.data as T
}

export function setCache<T>(key: string, data: T): void {
  // Cap entries
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS })
}

export function clearCache(): void {
  cache.clear()
}
