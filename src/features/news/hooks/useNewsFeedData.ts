/* src/features/news/hooks/useNewsFeedData.ts

   Réécriture. Trois corrections par rapport à la version actuelle :

   1. `catch {}` silencieux → l'erreur est loggée (captureException) ET
      exposée à l'UI. Aujourd'hui un fil en échec est visuellement identique
      à un fil vide : l'utilisateur croit qu'il n'y a rien à lire.
   2. `finally` qui remet tous les flags à false même après un démontage :
      remplacé par un seul `settle()` gardé par mountedRef.
   3. `fetchPosts` dépendait de `hasMore` → nouvelle identité à chaque page →
      l'effet de premier chargement se réévaluait sans arrêt. `hasMore` est
      lu depuis le store au moment de l'appel. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import { captureException } from '@/lib/sentry'
import { newsFeedSource } from '../services/newsFeedSource'
import type { NewsFeedState } from '../store/newsFeedStore'

export type NewsFeedError = 'network' | 'unknown'

export function useNewsFeedData({
  store,
  enabled = true,
}: {
  store: StoreApi<NewsFeedState>
  enabled?: boolean
}) {
  const mountedRef = useRef(true)
  const firstFetchStarted = useRef(false)
  const [error, setError] = useState<NewsFeedError | null>(null)

  const posts = useStore(store, (state) => state.posts)
  const loading = useStore(store, (state) => state.loading)
  const refreshing = useStore(store, (state) => state.refreshing)
  const loadingMore = useStore(store, (state) => state.loadingMore)
  const hasMore = useStore(store, (state) => state.hasMore)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  const settle = useCallback(() => {
    if (!mountedRef.current) return

    const state = store.getState()

    state.setLoading(false)
    state.setRefreshing(false)
    state.setLoadingMore(false)
  }, [store])

  const fetchPosts = useCallback(
    async (isRefresh = false) => {
      if (newsFeedSource.isLoading) return

      const state = store.getState()

      if (!isRefresh && !state.hasMore) return

      setError(null)

      if (isRefresh) {
        state.setRefreshing(true)
        state.setLoading(state.posts.length === 0)
      } else {
        state.setLoadingMore(true)
      }

      try {
        const page = await newsFeedSource.fetchNext()

        if (!mountedRef.current) return

        if (!page) {
          settle()
          return
        }

        if (page.isFirst || isRefresh) {
          state.setPosts(page.posts)
        } else if (page.posts.length > 0) {
          state.appendPosts(page.posts)
        }

        state.setHasMore(page.hasMore)
      } catch (caught) {
        captureException(
          caught instanceof Error ? caught : new Error(String(caught)),
          { context: 'useNewsFeedData.fetchPosts', isRefresh },
        )

        if (mountedRef.current) {
          const message = String((caught as Error)?.message ?? '').toLowerCase()

          setError(
            message.includes('offline') || message.includes('network')
              ? 'network'
              : 'unknown',
          )
        }
      } finally {
        settle()
      }
    },
    [settle, store],
  )

  useEffect(() => {
    if (!enabled || firstFetchStarted.current) return

    firstFetchStarted.current = true
    void fetchPosts()
  }, [enabled, fetchPosts])

  const loadMore = useCallback(() => {
    const state = store.getState()

    if (state.loading || state.loadingMore || !state.hasMore || error) return

    void fetchPosts(false)
  }, [error, fetchPosts, store])

  const refresh = useCallback(() => {
    newsFeedSource.reset()
    firstFetchStarted.current = true
    store.getState().setHasMore(true)
    void fetchPosts(true)
  }, [fetchPosts, store])

  const retry = useCallback(() => {
    setError(null)
    void fetchPosts(posts.length === 0)
  }, [fetchPosts, posts.length])

  return {
    posts,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    isEmpty: !loading && !error && posts.length === 0,
    loadMore,
    refresh,
    retry,
  }
}
