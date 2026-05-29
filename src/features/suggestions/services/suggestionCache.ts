import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FollowSuggestion, InterestProfile } from '../types'
import { CACHE_KEY_SUGGESTIONS, CACHE_KEY_INTERESTS, CACHE_TTL_MS } from '../types'

interface SuggestionsCacheEntry {
  uid: string
  suggestions: FollowSuggestion[]
  cachedAt: number
}

interface InterestsCacheEntry {
  uid: string
  profile: InterestProfile
  cachedAt: number
}

export async function getCachedSuggestions(uid: string): Promise<FollowSuggestion[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_SUGGESTIONS}_${uid}`)
    if (!raw) return null
    const entry: SuggestionsCacheEntry = JSON.parse(raw)
    if (entry.uid !== uid) return null
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(`${CACHE_KEY_SUGGESTIONS}_${uid}`)
      return null
    }
    return entry.suggestions
  } catch {
    return null
  }
}

export async function setCachedSuggestions(uid: string, suggestions: FollowSuggestion[]): Promise<void> {
  try {
    const entry: SuggestionsCacheEntry = { uid, suggestions, cachedAt: Date.now() }
    await AsyncStorage.setItem(`${CACHE_KEY_SUGGESTIONS}_${uid}`, JSON.stringify(entry))
  } catch {
  }
}

export async function clearSuggestionCache(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_KEY_SUGGESTIONS}_${uid}`)
  } catch {
  }
}

export async function getCachedInterests(uid: string): Promise<InterestProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_INTERESTS}_${uid}`)
    if (!raw) return null
    const entry: InterestsCacheEntry = JSON.parse(raw)
    if (entry.uid !== uid) return null
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(`${CACHE_KEY_INTERESTS}_${uid}`)
      return null
    }
    return entry.profile
  } catch {
    return null
  }
}

export async function setCachedInterests(uid: string, profile: InterestProfile): Promise<void> {
  try {
    const entry: InterestsCacheEntry = { uid, profile, cachedAt: Date.now() }
    await AsyncStorage.setItem(`${CACHE_KEY_INTERESTS}_${uid}`, JSON.stringify(entry))
  } catch {
  }
}
