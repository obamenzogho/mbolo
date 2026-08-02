/* src/features/news/hooks/useNewsFeedData.ts

   Réécriture. Trois corrections par rapport à la version actuelle :

   1. `catch {}` silencieux → l'erreur est loggée (captureException) ET
      exposée à l'UI. Aujourd'hui un fil en échec est visuellement identique
      à un fil vide : l'utilisateur croit qu'il n'y a rien à lire.
   2. `finally` qui remet tous les flags à false même après un démontage :
      remplacé par un seul `settle()` gardé par mountedRef.
   3. `fetchPosts` dépendait de `hasMore` → nouvelle identité à chaque page →
      l'effet de premier chargement se réévaluait sans arrêt. `hasMore` est
      lu depuis le store au moment de l'appel.

   Comportement progressif façon Facebook :
   - Le 1er chargement affiche le skeleton, puis les posts apparaissent par
     petits lots dès qu'ils sont prêts (plus d'attente d'une page de 20).
   - Entre le 1er lot reçu et la fin de la page, `streaming` reste vrai :
     l'écran conserve le skeleton en arrière-plan, les posts réels se
     superposent progressivement.
   - Pendant que l'utilisateur lit la 1re page, le préchargement invisible
     prépare la suivante en arrière-plan. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import { captureException } from '@/lib/sentry'
import { newsFeedSource } from '../services/newsFeedSource'
import type { NewsFeedBatch } from '../services/newsFeedSource'
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
  const streaming = useStore(store, (state) => state.streaming)

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
    state.setStreaming(false)
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

      if (isRefresh || state.posts.length > 0) {
        /* Mode progressif : on pousse chaque lot dès qu'il est prêt. */
        if (isRefresh) {
          state.setPosts([])
          state.setHasMore(true)
        }

        try {
          let firstEmitted = state.posts.length > 0

          const page = await newsFeedSource.fetchNext({
            onBatch: (batch: NewsFeedBatch) => {
              if (!mountedRef.current) return

              if (batch.posts.length === 0) {
                if (batch.done) state.setStreaming(false)

                return
              }

              if (isRefresh || !firstEmitted) {
                state.setPosts(batch.posts)
                firstEmitted = true
                state.setLoading(false)
                state.setStreaming(true)
              } else {
                state.appendPosts(batch.posts)
              }

              if (batch.done) state.setStreaming(false)
            },
          })

          if (!mountedRef.current) return

          if (!page) {
            settle()
            return
          }

          /* `page.posts` est vide en mode progressif (tout est déjà émis
             via onBatch). On se contente de mettre à jour `hasMore`. */
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

        return
      }

      /* Mode historique fallback : pas de flux progressif (rare). */
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
    streaming,
    error,
    isEmpty: !loading && !error && posts.length === 0,
    loadMore,
    refresh,
    retry,
  }
}
