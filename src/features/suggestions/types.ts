export type SuggestionReason =
  | 'MUTUAL_FOLLOWS'
  | 'SIMILAR_INTERESTS'
  | 'TRENDING_CREATOR'
  | 'SAME_COMMUNITY'
  | 'DM_INTERACTION'
  | 'LOCATION_SIMILARITY'
  | 'NEW_CREATOR_BOOST'
  | 'POPULAR_IN_YOUR_AREA'
  | 'FOLLOWED_BY_FRIENDS'

export interface FollowSuggestion {
  id: string
  user: {
    id: string
    nom: string
    pseudo: string
    photoURL?: string
    bio?: string
    verified?: boolean
    followerCount?: number
    followingCount?: number
  }
  score: number
  reason: SuggestionReason
  reasonLabel: string
  mutualFollowers: string[]
  mutualCount: number
  category?: string
}

export interface ScoredUser {
  userId: string
  score: number
  reason: SuggestionReason
  reasonLabel: string
  mutualFollowers: string[]
  mutualCount: number
}

export interface UserInterest {
  topic: string
  weight: number
  lastUpdated: number
}

export interface InterestProfile {
  userId: string
  interests: UserInterest[]
  topHashtags: string[]
  topCategories: string[]
}

export type SuggestionCategory =
  | 'for_you'
  | 'trending'
  | 'similar_creators'
  | 'friends_follow'
  | 'local'
  | 'new_creators'

export const WEIGHT_MUTUAL_FOLLOWS = 0.35
export const WEIGHT_INTEREST_SIMILARITY = 0.25
export const WEIGHT_TRENDING = 0.15
export const WEIGHT_PROFILE_VISITS = 0.10
export const WEIGHT_DM_INTERACTION = 0.10
export const WEIGHT_LOCATION = 0.05

export const BONUS_TRENDING_CREATOR = 100
export const BONUS_SAME_CLUSTER = 80
export const BONUS_HIGH_ENGAGEMENT = 50
export const BONUS_NEW_CREATOR = 30

export const REASON_LABELS: Record<SuggestionReason, string> = {
  MUTUAL_FOLLOWS: 'Suivi par des amis',
  SIMILAR_INTERESTS: 'Centres d\'intérêt similaires',
  TRENDING_CREATOR: 'Créateur tendance',
  SAME_COMMUNITY: 'Dans ta communauté',
  DM_INTERACTION: 'Vous vous êtes parlé',
  LOCATION_SIMILARITY: 'Dans ta région',
  NEW_CREATOR_BOOST: 'Nouveau créateur à découvrir',
  POPULAR_IN_YOUR_AREA: 'Populaire dans ta région',
  FOLLOWED_BY_FRIENDS: 'Suivi par tes amis',
}

export const CACHE_KEY_SUGGESTIONS = '@mbolo_suggestions_cache'
export const CACHE_KEY_INTERESTS = '@mbolo_interests_cache'
export const CACHE_TTL_MS = 30 * 60 * 1000
export const MAX_SUGGESTIONS = 50
export const BATCH_SIZE = 10
