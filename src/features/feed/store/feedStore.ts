/* feedStore — factory Zustand pour stores de feed isolés.
   Rôle : créer des instances de store indépendantes pour chaque
   type de feed (Pour toi, Suivi). Chaque instance a son propre
   currentIndex, videos, isScrolling, etc. */

import { createStore, useStore } from 'zustand'
import type { UseBoundStore, StoreApi } from 'zustand'
import type { Video } from '../../../types'

export const FEED_DEBUG = false

type PlayerRole = 'PREV' | 'CURRENT' | 'NEXT'

export interface FeedState {
  videos: Video[]
  currentIndex: number
  previousIndex: number
  isScrolling: boolean
  isLoadingMore: boolean
  hasMore: boolean
  playerMap: Record<string, PlayerRole>
  networkQuality: 'FAST' | 'MEDIUM' | 'SLOW'
  pendingActivation: boolean

  setVideos: (videos: Video[]) => void
  appendVideos: (videos: Video[]) => void
  setCurrentIndex: (index: number) => void
  setIsScrolling: (scrolling: boolean) => void
  setLoadingMore: (loading: boolean) => void
  setHasMore: (hasMore: boolean) => void
  setPlayerRole: (videoId: string, role: PlayerRole | null) => void
  setNetworkQuality: (quality: 'FAST' | 'MEDIUM' | 'SLOW') => void
  skipToNext: () => void
  setPendingActivation: (pending: boolean) => void
}

function createFeedStore() {
  return createStore<FeedState>()((set) => ({
    videos: [],
    currentIndex: 0,
    previousIndex: 0,
    isScrolling: false,
    isLoadingMore: false,
    hasMore: true,
    playerMap: {},
    networkQuality: 'MEDIUM',
    pendingActivation: true,

    setVideos: (videos) => set({ videos, isLoadingMore: false }),

    appendVideos: (videos) =>
      set((state) => ({ videos: [...state.videos, ...videos], isLoadingMore: false })),

    setCurrentIndex: (index) =>
      set((state) => ({ previousIndex: state.currentIndex, currentIndex: index })),

    setIsScrolling: (isScrolling) => set({ isScrolling }),

    setLoadingMore: (isLoadingMore) => set({ isLoadingMore }),

    setHasMore: (hasMore) => set({ hasMore }),

    setPlayerRole: (videoId, role) =>
      set((state) => {
        const next = { ...state.playerMap }
        if (role === null) {
          delete next[videoId]
        } else {
          next[videoId] = role
        }
        return { playerMap: next }
      }),

    setNetworkQuality: (networkQuality) => set({ networkQuality }),

    skipToNext: () =>
      set((state) => {
        if (state.videos.length === 0) return {}
        return {
          previousIndex: state.currentIndex,
          currentIndex: Math.min(state.currentIndex + 1, state.videos.length - 1),
        }
      }),

    setPendingActivation: (pendingActivation) => set({ pendingActivation }),
  }))
}

export const forYouFeedStore = createFeedStore()
export const followingFeedStore = createFeedStore()
export const localFeedStore = createFeedStore()

export function useForYouFeedStore<T>(selector: (s: FeedState) => T): T {
  return useStore(forYouFeedStore, selector)
}

export function useFollowingFeedStore<T>(selector: (s: FeedState) => T): T {
  return useStore(followingFeedStore, selector)
}

function _useFeedStore<T>(selector: (s: FeedState) => T): T {
  return useStore(forYouFeedStore, selector)
}

export const useFeedStore = Object.assign(
  _useFeedStore,
  forYouFeedStore,
) as unknown as UseBoundStore<StoreApi<FeedState>>
