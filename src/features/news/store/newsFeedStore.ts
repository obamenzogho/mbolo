import { createStore, useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import type { NewsPost } from '../types'

export interface NewsFeedState {
  posts: NewsPost[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  hasMore: boolean

  setPosts: (posts: NewsPost[]) => void
  appendPosts: (posts: NewsPost[]) => void
  updatePost: (
    postId: string,
    updates: Partial<NewsPost>,
  ) => void
  removePost: (postId: string) => void
  setLoading: (loading: boolean) => void
  setRefreshing: (refreshing: boolean) => void
  setLoadingMore: (loading: boolean) => void
  setHasMore: (hasMore: boolean) => void
}

function createNewsFeedStore() {
  return createStore<NewsFeedState>()((set) => ({
    posts: [],
    loading: true,
    refreshing: false,
    loadingMore: false,
    hasMore: true,

    setPosts: (posts) =>
      set({
        posts,
        loading: false,
        refreshing: false,
        loadingMore: false,
      }),

    appendPosts: (newPosts) =>
      set((state) => {
        const existingIds = new Set(
          state.posts.map((post) => post.id),
        )

        const uniquePosts = newPosts.filter(
          (post) => !existingIds.has(post.id),
        )

        return {
          posts: [...state.posts, ...uniquePosts],
          loadingMore: false,
        }
      }),

    updatePost: (postId, updates) =>
      set((state) => ({
        posts: state.posts.map((post) =>
          post.id === postId
            ? { ...post, ...updates }
            : post,
        ),
      })),

    removePost: (postId) =>
      set((state) => ({
        posts: state.posts.filter(
          (post) => post.id !== postId,
        ),
      })),

    setLoading: (loading) => set({ loading }),

    setRefreshing: (refreshing) =>
      set({ refreshing }),

    setLoadingMore: (loadingMore) =>
      set({ loadingMore }),

    setHasMore: (hasMore) => set({ hasMore }),
  }))
}

export const newsFeedStore = createNewsFeedStore()

export function useNewsFeedStore<T>(
  selector: (state: NewsFeedState) => T,
): T {
  return useStore(newsFeedStore, selector)
}

export type NewsFeedStoreApi = StoreApi<NewsFeedState>