/* useNewsFeedData — pagination du fil d'actualité.
   Branche le newsFeedStore sur newsFeedSource.
   Pattern identique à useFeedData.ts. */

import { useEffect, useRef, useCallback } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import { newsFeedSource } from '../services/newsFeedSource'
import type { NewsFeedState } from '../store/newsFeedStore'

const TRIGGER_OFFSET = 10

export function useNewsFeedData({ store }: { store: StoreApi<NewsFeedState> }) {
  const fetchAttemptedRef = useRef(false)
  const posts = useStore(store, (s) => s.posts)
  const isLoadingMore = useStore(store, (s) => s.loadingMore)
  const hasMore = useStore(store, (s) => s.hasMore)
  const setPosts = useStore(store, (s) => s.setPosts)
  const appendPosts = useStore(store, (s) => s.appendPosts)
  const setLoadingMore = useStore(store, (s) => s.setLoadingMore)
  const setHasMore = useStore(store, (s) => s.setHasMore)
  const setLoading = useStore(store, (s) => s.setLoading)

  const fetchPosts = useCallback(async () => {
    if (newsFeedSource.isLoading || !newsFeedSource.hasMoreFlag) return
    setLoadingMore(true)
    const page = await newsFeedSource.fetchNext()
    if (!page) {
      setLoadingMore(false)
      return
    }
    if (page.posts.length > 0) {
      if (page.isFirst) setPosts(page.posts)
      else appendPosts(page.posts)
    } else {
      setLoadingMore(false)
    }
    setHasMore(page.hasMore)
  }, [setPosts, appendPosts, setLoadingMore, setHasMore])

  // Premier fetch
  useEffect(() => {
    if (fetchAttemptedRef.current) return
    if (posts.length > 0) { fetchAttemptedRef.current = true; return }
    if (newsFeedSource.isLoading) return
    fetchAttemptedRef.current = true
    fetchPosts()
  }, [fetchPosts, posts.length])

  // Pagination : fetch quand on approche de la fin
  useEffect(() => {
    if (posts.length === 0) return
    if (!hasMore) return
    if (newsFeedSource.isLoading) return

    // Utilise onEndReached du FlatList dans le composant parent
    // Ici on expose juste loadMore
  }, [posts.length, hasMore])

  const loadMore = useCallback(() => {
    if (!hasMore || newsFeedSource.isLoading) return
    fetchPosts()
  }, [hasMore, fetchPosts])

  const refresh = useCallback(() => {
    setLoading(true)
    newsFeedSource.reset()
    fetchAttemptedRef.current = true
    setHasMore(true)
    fetchPosts()
  }, [fetchPosts, setHasMore, setLoading])

  return {
    posts,
    isLoadingMore,
    hasMore,
    isEmpty: !useStore(store, (s) => s.loading) && posts.length === 0,
    loadMore,
    refresh,
  }
}
