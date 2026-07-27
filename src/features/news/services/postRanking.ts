/* postRanking — algorithme de ranking client-side pour le fil d'actualité.
   Pattern identique à rankVideos.ts : engagement × affinity × freshness × format weight. */

import type { NewsPost } from '../types'

export interface PostUserTaste {
  likedAuthors: Record<string, number>
  likedHashtags: Record<string, number>
}

export const EMPTY_TASTE: PostUserTaste = { likedAuthors: {}, likedHashtags: {} }

const HOUR = 1000 * 60 * 60

// Poids par format de contenu (vidéo > article > image > texte)
const FORMAT_WEIGHTS: Record<string, number> = {
  video: 1.5,
  video_share: 1.4,
  article: 1.3,
  image: 1.2,
  carousel: 1.2,
  poll: 1.1,
  text: 1.0,
}

export function scorePost(post: NewsPost, taste: PostUserTaste, now = Date.now()): number {
  // Engagement (log scale, même pattern que rankVideos.ts)
  const engagement =
    Math.log1p(post.likes ?? 0) * 1.0 +
    Math.log1p(post.comments ?? 0) * 1.5 +
    Math.log1p(post.shares ?? 0) * 2.0 +
    Math.log1p(post.saves ?? 0) * 1.8 +
    Math.log1p(post.reactionCounts?.total ?? 0) * 1.2

  // Affinity : fréquence d'interaction avec cet auteur
  const affinity = taste.likedAuthors[post.userId] ?? 0

  // Freshness : decay exponentiel, half-life 12h
  const ageHours = Math.max(0, (now - post.createdAt.getTime()) / HOUR)
  const freshness = Math.exp(-ageHours / 12)

  // Poids du format
  const formatWeight = FORMAT_WEIGHTS[post.format] ?? 1.0

  // Score serveur (si disponible)
  const baseScore = post.rankingScore ?? 0

  return (engagement * 1.0 + affinity * 3.0 + freshness * 4.0) * formatWeight + baseScore * 0.5
}

export function rankPosts(posts: NewsPost[], taste: PostUserTaste): NewsPost[] {
  const now = Date.now()
  return [...posts]
    .map((p) => ({ p, s: scorePost(p, taste, now) * (0.92 + Math.random() * 0.16) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p)
}
