/* buildPostUserTaste — construit le profil de goûts utilisateur pour le ranking.
   Pattern identique à userTaste.ts : lit les likes récents pour déterminer
   les auteurs et hashtags préférés. */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import type { PostUserTaste } from './postRanking'

const INTERACTION_LIMIT = 50

export async function buildPostUserTaste(uid: string): Promise<PostUserTaste> {
  const taste: PostUserTaste = { likedAuthors: {}, likedHashtags: {} }

  try {
    // Posts que l'utilisateur a aimés (via likedBy array)
    const q = query(
      collection(db, 'posts'),
      where('likedBy', 'array-contains', uid),
      orderBy('createdAt', 'desc'),
      limit(INTERACTION_LIMIT),
    )
    const snap = await getDocs(q)

    for (const doc of snap.docs) {
      const data = doc.data() as any
      const authorId = data.userId as string

      // Compte les interactions par auteur
      taste.likedAuthors[authorId] = (taste.likedAuthors[authorId] ?? 0) + 1

      // Compte les interactions par hashtag
      const hashtags: string[] = data.hashtags ?? []
      for (const tag of hashtags) {
        taste.likedHashtags[tag] = (taste.likedHashtags[tag] ?? 0) + 1
      }
    }
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'buildPostUserTaste' })
  }

  return taste
}
