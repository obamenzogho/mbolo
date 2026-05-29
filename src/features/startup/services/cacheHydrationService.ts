import AsyncStorage from '@react-native-async-storage/async-storage'
import { captureException } from '@/lib/sentry'
import type { Video } from '@/types'

const CACHED_FEED_KEY = '@mbolo_cached_feed'
const CACHED_SETTINGS_KEY = '@mbolo_cached_settings'

interface CachedSettings {
  language?: string
  dataSaver?: boolean
  lastTab?: string
  lastVideoIndex?: number
}

export async function hydrateCache(): Promise<{
  cachedFeed: Video[]
  settings: CachedSettings | null
}> {
  try {
    const [feedRaw, settingsRaw] = await Promise.all([
      AsyncStorage.getItem(CACHED_FEED_KEY),
      AsyncStorage.getItem(CACHED_SETTINGS_KEY),
    ])

    const cachedFeed: Video[] = feedRaw ? JSON.parse(feedRaw) : []
    const settings: CachedSettings | null = settingsRaw ? JSON.parse(settingsRaw) : null

    return { cachedFeed, settings }
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), { context: 'hydrateCache' })
    return { cachedFeed: [], settings: null }
  }
}

export async function cacheFeed(videos: Video[]) {
  try {
    const slice = videos.slice(0, 20)
    await AsyncStorage.setItem(CACHED_FEED_KEY, JSON.stringify(slice))
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), { context: 'cacheFeed' })
  }
}

export async function cacheSettings(settings: CachedSettings) {
  try {
    const existing = await AsyncStorage.getItem(CACHED_SETTINGS_KEY)
    const merged = existing ? { ...JSON.parse(existing), ...settings } : settings
    await AsyncStorage.setItem(CACHED_SETTINGS_KEY, JSON.stringify(merged))
  } catch (err) {
    captureException(err instanceof Error ? err : new Error(String(err)), { context: 'cacheSettings' })
  }
}
