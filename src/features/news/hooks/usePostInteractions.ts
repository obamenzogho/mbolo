/* src/features/news/hooks/usePostInteractions.ts

   Un seul hook au niveau de l'écran, au lieu de useReactions + useNewsRepost
   montés dans CHAQUE carte (2 x N hooks, N listeners Firestore sur un fil de
   50 posts). Écriture optimiste dans le store, rollback si le serveur refuse.

   Tous les handlers sont stables (deps vides ou store/uid) : indispensable
   pour que le comparateur mémo de PostCard serve à quelque chose. */

import { useCallback, useMemo, useRef, useState } from 'react'
import { Share } from 'react-native'
import type { StoreApi } from 'zustand'
import { captureException } from '@/lib/sentry'
import {
  incrementShareCount,
  setPostReaction,
  togglePostRepost,
  togglePostSave,
} from '../services/postInteractions'
import type { NewsFeedState } from '../store/newsFeedStore'
import type { NewsPost, PostReactionType, ReactionCounts } from '../types'
import type { PostViewerState } from '../components/post/PostCard'

const EMPTY_COUNTS: ReactionCounts = {
  like: 0,
  love: 0,
  fire: 0,
  clap: 0,
  total: 0,
}

function shiftCounts(
  counts: ReactionCounts | undefined,
  previous: PostReactionType | null,
  next: PostReactionType | null,
): ReactionCounts {
  const base = { ...(counts ?? EMPTY_COUNTS) }

  if (previous) base[previous] = Math.max(0, base[previous] - 1)
  if (next) base[next] += 1

  base.total = Math.max(0, base.total + ((next ? 1 : 0) - (previous ? 1 : 0)))

  return base
}

function withUser(list: string[], userId: string, present: boolean): string[] {
  const set = new Set(list)

  if (present) set.add(userId)
  else set.delete(userId)

  return Array.from(set)
}

export function usePostInteractions({
  store,
  currentUserId,
  patch: customPatch,
}: {
  store?: StoreApi<NewsFeedState>
  currentUserId: string
  /** Sortie des écritures optimistes. Par défaut : le store du fil.
      Utile pour un post hors store (ex. post-detail) qui vit en état local. */
  patch?: (postId: string, updates: Partial<NewsPost>) => void
}) {
  /** Posts dont un repost est en vol : évite le double-tap. */
  const [pendingReposts, setPendingReposts] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const inFlight = useRef<Set<string>>(new Set())

  const patch = useCallback(
    (postId: string, updates: Partial<NewsPost>) => {
      if (customPatch) {
        customPatch(postId, updates)
      } else {
        store?.getState().updatePost(postId, updates)
      }
    },
    [customPatch, store],
  )

  /** État viewer dérivé, uniquement des primitives → mémo efficace. */
  const viewerStateFor = useCallback(
    (post: NewsPost): PostViewerState => ({
      reaction:
        post.myReaction ??
        (post.likedBy.includes(currentUserId) ? 'like' : null),
      saved: post.savedBy.includes(currentUserId),
      reposted: post.repostedBy.includes(currentUserId),
      repostCount: post.reposts,
      reactionTotal: post.reactionCounts?.total ?? post.likes,
      repostPending: pendingReposts.has(post.id),
    }),
    [currentUserId, pendingReposts],
  )

  const applyReaction = useCallback(
    async (post: NewsPost, next: PostReactionType | null) => {
      if (!currentUserId) return

      const previous =
        post.myReaction ?? (post.likedBy.includes(currentUserId) ? 'like' : null)

      if (previous === next) return

      const snapshot = {
        myReaction: post.myReaction,
        reactionCounts: post.reactionCounts,
        likes: post.likes,
        likedBy: post.likedBy,
      }

      patch(post.id, {
        myReaction: next,
        reactionCounts: shiftCounts(post.reactionCounts, previous, next),
        likes: Math.max(0, post.likes + ((next ? 1 : 0) - (previous ? 1 : 0))),
        likedBy: withUser(post.likedBy, currentUserId, !!next),
      })

      const result = await setPostReaction(post.id, currentUserId, next)

      if (!result) patch(post.id, snapshot)
    },
    [currentUserId, patch],
  )

  const onToggleReaction = useCallback(
    (post: NewsPost) => {
      const current =
        post.myReaction ?? (post.likedBy.includes(currentUserId) ? 'like' : null)

      void applyReaction(post, current ? null : 'like')
    },
    [applyReaction, currentUserId],
  )

  const onSelectReaction = useCallback(
    (post: NewsPost, type: PostReactionType) => {
      const current =
        post.myReaction ?? (post.likedBy.includes(currentUserId) ? 'like' : null)

      void applyReaction(post, current === type ? null : type)
    },
    [applyReaction, currentUserId],
  )

  const onToggleSave = useCallback(
    (post: NewsPost) => {
      if (!currentUserId) return

      const wasSaved = post.savedBy.includes(currentUserId)

      patch(post.id, {
        savedBy: withUser(post.savedBy, currentUserId, !wasSaved),
        saves: Math.max(0, post.saves + (wasSaved ? -1 : 1)),
      })

      void togglePostSave(post.id, currentUserId).then((result) => {
        if (!result) {
          patch(post.id, { savedBy: post.savedBy, saves: post.saves })
        }
      })
    },
    [currentUserId, patch],
  )

  const onToggleRepost = useCallback(
    (post: NewsPost) => {
      if (!currentUserId || inFlight.current.has(post.id)) return

      inFlight.current.add(post.id)
      setPendingReposts(new Set(inFlight.current))

      const wasReposted = post.repostedBy.includes(currentUserId)

      patch(post.id, {
        repostedBy: withUser(post.repostedBy, currentUserId, !wasReposted),
        reposts: Math.max(0, post.reposts + (wasReposted ? -1 : 1)),
      })

      void togglePostRepost(post.id, currentUserId)
        .then((result) => {
          if (!result) {
            patch(post.id, {
              repostedBy: post.repostedBy,
              reposts: post.reposts,
            })
          }
        })
        .finally(() => {
          inFlight.current.delete(post.id)
          setPendingReposts(new Set(inFlight.current))
        })
    },
    [currentUserId, patch],
  )

  const onShare = useCallback(
    async (post: NewsPost) => {
      try {
        const result = await Share.share({
          message: post.text
            ? `${post.text}\n\nPublication Mbolo`
            : 'Découvre cette publication sur Mbolo',
        })

        if (result.action === Share.sharedAction) {
          patch(post.id, { shares: post.shares + 1 })
          void incrementShareCount(post.id)
        }
      } catch (error) {
        captureException(
          error instanceof Error ? error : new Error(String(error)),
          { context: 'usePostInteractions.onShare', postId: post.id },
        )
      }
    },
    [patch],
  )

  return useMemo(
    () => ({
      viewerStateFor,
      onToggleReaction,
      onSelectReaction,
      onToggleSave,
      onToggleRepost,
      onShare: (post: NewsPost) => void onShare(post),
    }),
    [
      onSelectReaction,
      onShare,
      onToggleReaction,
      onToggleRepost,
      onToggleSave,
      viewerStateFor,
    ],
  )
}
