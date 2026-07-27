import { useStartupStore } from '../store/startupStore'
import { restoreSession } from './sessionService'
import { hydrateCache, cacheFeed } from './cacheHydrationService'
import { preloadNotifications, warmFirestoreConnections } from './preloadService'
import { preloadFirstVideos } from './videoPreloadService'
import { markStartupPhase, reportStartupComplete, reportStartupError } from './startupAnalytics'
import { primeForYouFeed } from '@/features/feed/services/forYouFeedSource'
import { forYouFeedStore } from '@/features/feed/store/feedStore'
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

    // Amorce la 1re page du feed « Pour toi » via la MÊME source (donc le même
    // classement) que useFeedData, et seed directement le feedStore : le feed
    // s'affiche déjà rempli (pas de loader) et la 1re vidéo est exactement celle
    // classée en tête (alignement startup ↔ feed garanti).
    const [feedPage] = await Promise.all([
      primeForYouFeed(),
      preloadNotifications(),
      warmFirestoreConnections(),
    ])

    const rankedFeed = feedPage?.videos ?? []
    result.freshFeed = rankedFeed

    if (rankedFeed.length > 0) {
      forYouFeedStore.getState().setVideos(rankedFeed)
      forYouFeedStore.getState().setHasMore(feedPage!.hasMore)
      cacheFeed(rankedFeed)
      // Précharge la miniature de la 1re vidéo classée (source du 1er rendu).
      preloadFirstVideos(rankedFeed).then((thumb) => {
        if (thumb) store().setFirstThumbnailURL(thumb)
      })
    } else if (cachedFeed.length > 0) {
      // Pas de réseau : on retombe sur le cache disque pour un affichage immédiat.
      forYouFeedStore.getState().setVideos(cachedFeed)
      preloadFirstVideos(cachedFeed).then((thumb) => {
        if (thumb) store().setFirstThumbnailURL(thumb)
      })
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
