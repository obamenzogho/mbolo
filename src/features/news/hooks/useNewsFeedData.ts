/* useNewsFeedData — pagination du fil d'actualité.
   Branche le newsFeedStore sur newsFeedSource.
   Pattern identique à useFeedData.ts. */

import { useCallback, useEffect, useRef } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import { newsFeedSource } from '../services/newsFeedSource'
import type { NewsFeedState } from '../store/newsFeedStore'

export function useNewsFeedData({
  store,
}: {
  store: StoreApi<NewsFeedState>
}) {
  const firstFetchStarted = useRef(false)
  const mountedRef = useRef(true)

  const posts = useStore(store, (state) => state.posts)
  const loading = useStore(store, (state) => state.loading)
  const loadingMore = useStore(store, (state) => state.loadingMore)
  const hasMore = useStore(store, (state) => state.hasMore)

  const setPosts = useStore(store, (state) => state.setPosts)
  const appendPosts = useStore(store, (state) => state.appendPosts)
  const setLoading = useStore(store, (state) => state.setLoading)
  const setLoadingMore = useStore(store, (state) => state.setLoadingMore)
  const setHasMore = useStore(store, (state) => state.setHasMore)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetchPosts = useCallback(
    async (isRefresh = false) => {
      if (newsFeedSource.isLoading) {
        return
      }

      if (!isRefresh && !hasMore) {
        return
      }

      if (isRefresh) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const page = await newsFeedSource.fetchNext()

      if (!mountedRef.current) {
        return
      }

      if (!page) {
        setLoading(false)
        setLoadingMore(false)
        return
      }

      if (page.isFirst || isRefresh) {
        setPosts(page.posts)
      } else if (page.posts.length > 0) {
        appendPosts(page.posts)
      }

      setHasMore(page.hasMore)
      setLoading(false)
      setLoadingMore(false)
    },
    [
      appendPosts,
      hasMore,
      setHasMore,
      setLoading,
      setLoadingMore,
      setPosts,
    ],
  )

  useEffect(() => {
    if (firstFetchStarted.current) {
      return
    }

    firstFetchStarted.current = true
    void fetchPosts()
  }, [fetchPosts])

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) {
      return
    }

    void fetchPosts()
  }, [fetchPosts, hasMore, loading, loadingMore])

  const refresh = useCallback(() => {
    newsFeedSource.reset()
    firstFetchStarted.current = true
    setHasMore(true)
    void fetchPosts(true)
  }, [fetchPosts, setHasMore])

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    isEmpty: !loading && posts.length === 0,
    loadMore,
    refresh,
  }
}
