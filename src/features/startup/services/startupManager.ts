import { useStartupStore } from '../store/startupStore'
import { restoreSession } from './sessionService'
import { hydrateCache } from './cacheHydrationService'
import { preloadFeed, preloadNotifications, warmFirestoreConnections } from './preloadService'
import { preloadFirstVideos } from './videoPreloadService'
import { markStartupPhase, reportStartupComplete, reportStartupError } from './startupAnalytics'
import type { Video } from '@/types'

interface StartupResult {
  user: any
  isAuthenticated: boolean
  cachedFeed: Video[]
  freshFeed: Video[]
}

export async function runStartup(): Promise<StartupResult> {
  const store = useStartupStore.getState
  store().setPhase('native_splash')

  const result: StartupResult = {
    user: null,
    isAuthenticated: false,
    cachedFeed: [],
    freshFeed: [],
  }

  try {
    store().setPhase('session')
    markStartupPhase('session')
    const { user, uid } = await restoreSession()
    result.user = user
    result.isAuthenticated = !!uid
    store().setUser(user as any)

    if (!uid) {
      store().setPhase('ready')
      return result
    }

    store().setPhase('hydrating')
    markStartupPhase('hydrating')
    const { cachedFeed, settings } = await hydrateCache()
    result.cachedFeed = cachedFeed
    store().setCachedVideos(cachedFeed)

    store().setPhase('preloading')
    markStartupPhase('preloading')

    const [freshFeed] = await Promise.all([
      preloadFeed(),
      preloadNotifications(),
      warmFirestoreConnections(),
    ])
    result.freshFeed = freshFeed

    const feedToPreload = freshFeed.length > 0 ? freshFeed : cachedFeed
    if (feedToPreload.length > 0) {
      preloadFirstVideos(feedToPreload)
    }

    store().setPhase('ready')
    markStartupPhase('ready')
    reportStartupComplete(store().timing)

    return result
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    store().setError(error)
    store().setPhase('error')
    reportStartupError(error, store().phase)
    return result
  }
}
