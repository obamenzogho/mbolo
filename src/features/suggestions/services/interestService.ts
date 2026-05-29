import { auth, db } from '@/lib/firebase'
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore'
import { captureException } from '@/lib/sentry'
import type { Video } from '@/types'
import type { UserInterest, InterestProfile } from '../types'
import { getCachedInterests, setCachedInterests } from './suggestionCache'

const INTEREST_CATEGORIES = [
  'humour', 'musique', 'danse', 'sport', 'football',
  'gaming', 'cuisine', 'voyage', 'mode', 'art',
  'education', 'nature', 'animaux', 'technologie', 'business',
  'afro', 'tradition', 'religion', 'actualite', 'tutoriel',
]

export async function buildInterestProfile(uid: string): Promise<InterestProfile | null> {
  try {
    const cached = await getCachedInterests(uid)
    if (cached) return cached

    const interests: UserInterest[] = []
    const hashtagCount = new Map<string, number>()
    let totalWeight = 0

    const watchedVideos = await getDocs(
      query(
        collection(db, 'videos'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
    )

    for (const video of watchedVideos.docs) {
      const data = video.data() as Video
      const tags = data.hashtags || []
      for (const tag of tags) {
        const normalized = tag.toLowerCase().replace(/^#/, '')
        hashtagCount.set(normalized, (hashtagCount.get(normalized) || 0) + 1)
      }

      const description = (data.description || '').toLowerCase()
      for (const category of INTEREST_CATEGORIES) {
        if (description.includes(category)) {
          hashtagCount.set(category, (hashtagCount.get(category) || 0) + 2)
        }
      }
    }

    const likedVideos = await getDocs(
      query(
        collection(db, 'videos'),
        where('likedBy', 'array-contains', uid),
        limit(50),
      ),
    )

    for (const video of likedVideos.docs) {
      const data = video.data() as Video
      const tags = data.hashtags || []
      for (const tag of tags) {
        const normalized = tag.toLowerCase().replace(/^#/, '')
        hashtagCount.set(normalized, (hashtagCount.get(normalized) || 0) + 1)
      }
    }

    const sorted = [...hashtagCount.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)

    for (const [topic, count] of sorted) {
      interests.push({
        topic,
        weight: count,
        lastUpdated: Date.now(),
      })
      totalWeight += count
    }

    for (const interest of interests) {
      interest.weight = totalWeight > 0
        ? Math.round((interest.weight / totalWeight) * 100)
        : 0
    }

    const topHashtags = sorted.slice(0, 10).map(([t]) => t)

    const topCategories = interests
      .filter((i) => INTEREST_CATEGORIES.includes(i.topic))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5)
      .map((i) => i.topic)

    const profile: InterestProfile = {
      userId: uid,
      interests,
      topHashtags,
      topCategories,
    }

    await setCachedInterests(uid, profile)
    return profile
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'buildInterestProfile' })
    return null
  }
}
