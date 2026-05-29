import { auth, db } from '@/lib/firebase'
import { doc, getDoc, getDocs, collection, query, limit, orderBy } from 'firebase/firestore'
import { captureException } from '@/lib/sentry'
import type { User } from '@/types'
import type {
  FollowSuggestion,
  ScoredUser,
  SuggestionReason,
  InterestProfile,
} from '../types'
import {
  WEIGHT_MUTUAL_FOLLOWS,
  WEIGHT_INTEREST_SIMILARITY,
  WEIGHT_TRENDING,
  WEIGHT_DM_INTERACTION,
  WEIGHT_LOCATION,
  BONUS_TRENDING_CREATOR,
  BONUS_HIGH_ENGAGEMENT,
  BONUS_NEW_CREATOR,
  BONUS_SAME_CLUSTER,
  MAX_SUGGESTIONS,
  REASON_LABELS,
} from '../types'
import { getCachedSuggestions, setCachedSuggestions } from './suggestionCache'

const CANDIDATE_POOL = 60
const MAX_MUTUAL_FETCH_PER_BATCH = 10

async function getFollowingList(uid: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    return snap.exists() ? (snap.data().following || []) : []
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getFollowingList' })
    return []
  }
}

async function getMutualFollows(
  uid: string,
  candidateId: string,
  following: string[],
): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'users', candidateId))
    if (!snap.exists()) return []
    const candidateFollowers: string[] = snap.data().followers || []
    return following.filter((fid) => candidateFollowers.includes(fid))
  } catch {
    return []
  }
}

function computeScore(
  candidateId: string,
  candidateData: any,
  uid: string,
  following: string[],
  mutualFollowers: string[],
  interestProfile: InterestProfile | null,
): ScoredUser | null {
  if (candidateId === uid) return null
  if (following.includes(candidateId)) return null

  const mutualCount = mutualFollowers.length
  const followerCount = candidateData.followerCount ?? candidateData.followers?.length ?? 0
  const followingCount = candidateData.followingCount ?? candidateData.following?.length ?? 0

  let score = 0
  let primaryReason: SuggestionReason = 'SIMILAR_INTERESTS'

  const mutualScore = mutualCount * 8
  if (mutualScore > 0) {
    primaryReason = mutualCount >= 3 ? 'FOLLOWED_BY_FRIENDS' : 'MUTUAL_FOLLOWS'
  }
  score += mutualScore * WEIGHT_MUTUAL_FOLLOWS

  if (interestProfile && interestProfile.interests.length > 0) {
    const candidateCategory = candidateData.category
      ? [candidateData.category.toLowerCase()]
      : []
    const matchCount = interestProfile.topHashtags.filter((h) =>
      candidateCategory.some((ch: string) => ch.includes(h) || h.includes(ch)),
    ).length
    const interestScore = Math.min(matchCount * 15, 60)
    if (interestScore > mutualScore && interestScore > 0) {
      primaryReason = 'SIMILAR_INTERESTS'
    }
    score += interestScore * WEIGHT_INTEREST_SIMILARITY
  }

  if (followerCount > 10000) {
    score += BONUS_TRENDING_CREATOR * WEIGHT_TRENDING
    primaryReason = 'TRENDING_CREATOR'
  } else if (followerCount > 1000) {
    score += 20 * WEIGHT_TRENDING
  }

  if (followerCount > 0 && followingCount > 0 && followerCount / followingCount > 50) {
    score += BONUS_HIGH_ENGAGEMENT * WEIGHT_TRENDING
  }

  if (mutualCount >= 5) {
    score += BONUS_SAME_CLUSTER
  }

  if (followerCount < 500 && followingCount < 200 && (candidateData.postsCount ?? 0) > 0) {
    score += BONUS_NEW_CREATOR
  }

  if (candidateData.city) {
    score += 5 * WEIGHT_LOCATION
  }

  const reasonLabel = mutualCount > 0
    ? (mutualCount >= 3
      ? `Suivi par ${mutualCount} amis`
      : `Suivi par ${mutualCount} personne${mutualCount > 1 ? 's' : ''}`)
    : REASON_LABELS[primaryReason]

  return {
    userId: candidateId,
    score,
    reason: primaryReason,
    reasonLabel,
    mutualFollowers,
    mutualCount,
  }
}

async function fetchTopUsers(limitCount: number): Promise<any[]> {
  try {
    const orderSnap = await getDocs(
      query(collection(db, 'users'), orderBy('followerCount', 'desc'), limit(limitCount)),
    )
    if (orderSnap.docs.length > 0) return orderSnap.docs

    const fallbackSnap = await getDocs(query(collection(db, 'users'), limit(limitCount)))
    return fallbackSnap.docs
  } catch {
    const fallbackSnap = await getDocs(query(collection(db, 'users'), limit(limitCount)))
    return fallbackSnap.docs
  }
}

export async function generateSuggestions(
  interestProfile: InterestProfile | null,
): Promise<FollowSuggestion[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []

  const cached = await getCachedSuggestions(uid)
  if (cached) return cached

  try {
    const following = await getFollowingList(uid)
    const candidateDocs = await fetchTopUsers(CANDIDATE_POOL)

    const candidates = candidateDocs
      .filter((d) => d.id !== uid && !following.includes(d.id))
      .slice(0, CANDIDATE_POOL)

    const scoredResults: ScoredUser[] = []
    const mutualCache = new Map<string, string[]>()

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]
      const data = candidate.data()

      let mutualFollowers: string[] = mutualCache.get(candidate.id)
      if (!mutualFollowers) {
        if (i < MAX_MUTUAL_FETCH_PER_BATCH) {
          mutualFollowers = await getMutualFollows(uid, candidate.id, following)
          mutualCache.set(candidate.id, mutualFollowers)
        } else {
          mutualFollowers = []
        }
      }

      const scored = computeScore(
        candidate.id, data, uid, following,
        mutualFollowers, interestProfile,
      )
      if (scored) scoredResults.push(scored)
    }

    scoredResults.sort((a, b) => b.score - a.score)
    const topScored = scoredResults.slice(0, MAX_SUGGESTIONS)

    const suggestions: FollowSuggestion[] = await Promise.all(
      topScored.map(async (scored) => {
        const snap = await getDoc(doc(db, 'users', scored.userId))
        const data = snap.data() || {}
        return {
          id: scored.userId,
          user: {
            id: scored.userId,
            nom: data.nom || '',
            pseudo: data.pseudo || '',
            photoURL: data.photoURL || '',
            bio: data.bio || '',
            verified: data.verified || false,
            followerCount: data.followerCount ?? data.followers?.length ?? 0,
            followingCount: data.followingCount ?? data.following?.length ?? 0,
          },
          score: scored.score,
          reason: scored.reason,
          reasonLabel: scored.reasonLabel,
          mutualFollowers: scored.mutualFollowers,
          mutualCount: scored.mutualCount,
          category: data.category || '',
        }
      }),
    )

    await setCachedSuggestions(uid, suggestions)
    return suggestions
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'generateSuggestions' })
    return []
  }
}

export async function getTrendingCreators(maxResults: number = 20): Promise<FollowSuggestion[]> {
  const uid = auth.currentUser?.uid
  if (!uid) return []

  try {
    const following = await getFollowingList(uid)
    const snap = await getDocs(query(collection(db, 'users'), limit(maxResults + following.length + 10)))

    const results: FollowSuggestion[] = []
    for (const doc of snap.docs) {
      if (doc.id === uid || following.includes(doc.id)) continue
      if (results.length >= maxResults) break
      const data = doc.data()
      const followerCount = data.followerCount ?? data.followers?.length ?? 0
      if (followerCount < 100) continue

      const mutual = await getMutualFollows(uid, doc.id, following)
      results.push({
        id: doc.id,
        user: {
          id: doc.id,
          nom: data.nom || '',
          pseudo: data.pseudo || '',
          photoURL: data.photoURL || '',
          bio: data.bio || '',
          verified: data.verified || false,
          followerCount,
          followingCount: data.followingCount ?? data.following?.length ?? 0,
        },
        score: followerCount + mutual.length * 50,
        reason: 'TRENDING_CREATOR',
        reasonLabel: 'Créateur tendance',
        mutualFollowers: mutual,
        mutualCount: mutual.length,
        category: data.category || '',
      })
    }

    return results
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getTrendingCreators' })
    return []
  }
}
