/* useFeedData — pagination du feed « Pour toi ».
   Rôle : branche le feedStore sur forYouFeedSource (source unique partagée avec
   le démarrage). Le premier fetch peut avoir déjà été amorcé par startupManager
   (feed déjà rempli à l'affichage → pas de loader) ; ici on ne fait que
   consommer les pages suivantes quand currentIndex approche de la fin.
   Paramètre store : instance Zustand isolée (forYouFeedStore). */

import { useEffect, useRef, useCallback } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import { FEED_DEBUG } from '../store/feedStore'
import { forYouFeedSource } from '../services/forYouFeedSource'
import type { FeedState } from '../store/feedStore'

const TRIGGER_OFFSET = 15

export function useFeedData({ store }: { store: StoreApi<FeedState> }) {
  const fetchAttemptedRef = useRef(false)
  const videos = useStore(store, (s) => s.videos)
  const currentIndex = useStore(store, (s) => s.currentIndex)
  const isLoadingMore = useStore(store, (s) => s.isLoadingMore)
  const hasMore = useStore(store, (s) => s.hasMore)
  const setVideos = useStore(store, (s) => s.setVideos)
  const appendVideos = useStore(store, (s) => s.appendVideos)
  const setLoadingMore = useStore(store, (s) => s.setLoadingMore)
  const setHasMore = useStore(store, (s) => s.setHasMore)

  const fetchVideos = useCallback(async () => {
    if (forYouFeedSource.isLoading || !forYouFeedSource.hasMoreValue) return
    setLoadingMore(true)
    const page = await forYouFeedSource.fetchNext()
    if (!page) {
      setLoadingMore(false)
      return
    }
    if (page.videos.length > 0) {
      if (page.isFirst) setVideos(page.videos)
      else appendVideos(page.videos)
    } else {
      setLoadingMore(false)
    }
    setHasMore(page.hasMore)
  }, [setVideos, appendVideos, setLoadingMore, setHasMore])

  // Premier fetch : seulement si le démarrage n'a pas déjà seedé le store et
  // qu'aucune page n'est déjà en vol côté source (évite un double fetch en cas
  // de course avec l'amorçage du démarrage). On ne latch le ref qu'une fois un
  // fetch réellement lancé, sinon on retente au prochain rendu.
  useEffect(() => {
    if (fetchAttemptedRef.current) return
    if (videos.length > 0) { fetchAttemptedRef.current = true; return }
    if (forYouFeedSource.isLoading) return // amorçage démarrage en cours
    fetchAttemptedRef.current = true
    fetchVideos()
  }, [fetchVideos, videos.length])

  useEffect(() => {
    if (videos.length === 0) return
    if (!hasMore) return
    if (forYouFeedSource.isLoading) return

    if (currentIndex >= videos.length - TRIGGER_OFFSET) {
      if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDDATA: trigger fetch at index', currentIndex, '/', videos.length)
      fetchVideos()
    }
  }, [currentIndex, videos.length, hasMore, fetchVideos])

  const refresh = useCallback(() => {
    forYouFeedSource.reset()
    fetchAttemptedRef.current = true
    setHasMore(true)
    fetchVideos()
  }, [fetchVideos, setHasMore])

  return {
    videos,
    isLoadingMore,
    hasMore,
    isEmpty: false,
    loadMore: fetchVideos,
    refresh,
  }
}
