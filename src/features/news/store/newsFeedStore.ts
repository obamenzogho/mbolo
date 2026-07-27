/* newsFeedStore — Zustand factory pour le fil d'actualité MBolo.
   Pattern identique à feedStore.ts : une instance singleton pour l'onglet Actus. */

import { createStore, useStore } from 'zustand'
import type { NewsPost } from '../types'

export interface NewsFeedState {
  posts: NewsPost[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  hasMore: boolean

  setPosts: (posts: NewsPost[]) => void
  appendPosts: (posts: NewsPost[]) => void
  updatePost: (postId: string, updates: Partial<NewsPost>) => void
  removePost: (postId: string) => void
  setLoading: (loading: boolean) => void
  setRefreshing: (refreshing: boolean) => void
  setLoadingMore: (loadingMore: boolean) => void
  setHasMore: (hasMore: boolean) => void
}

function createNewsFeedStore() {
  return createStore<NewsFeedState>()((set) => ({
    posts: [],
    loading: true,
    refreshing: false,
    loadingMore: false,
    hasMore: true,

    setPosts: (posts) => set({ posts, loading: false, refreshing: false, loadingMore: false }),

    appendPosts: (newPosts) =>
      set((state) => {
        const ids = new Set(state.posts.map((p) => p.id))
        const filtered = newPosts.filter((p) => !ids.has(p.id))
        return { posts: [...state.posts, ...filtered], loadingMore: false }
      }),

    updatePost: (postId, updates) =>
      set((state) => ({
        posts: state.posts.map((p) => (p.id === postId ? { ...p, ...updates } : p)),
      })),

    removePost: (postId) =>
      set((state) => ({ posts: state.posts.filter((p) => p.id !== postId) })),

    setLoading: (loading) => set({ loading }),
    setRefreshing: (refreshing) => set({ refreshing }),
    setLoadingMore: (loadingMore) => set({ loadingMore }),
    setHasMore: (hasMore) => set({ hasMore }),
  }))
}

// Instance singleton pour l'onglet Actus
export const newsFeedStore = createNewsFeedStore()

export function useNewsFeedStore<T>(selector: (s: NewsFeedState) => T): T {
  return useStore(newsFeedStore, selector)
}
