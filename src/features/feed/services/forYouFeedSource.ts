/* forYouFeedSource — source unique et partagée du feed « Pour toi ».
   Rôle : encapsule TOUTE la mécanique de fetch/ranking/pagination (curseur
   Firestore, vidéos vues, goûts utilisateur, filtres). Une seule instance
   (singleton) est partagée entre :
     - le démarrage (startupManager), qui « amorce » (prime) la 1re page pendant
       l'écran logo et seed le feedStore → le feed est déjà rempli à l'affichage
       (pas de loader) ;
     - useFeedData, qui adopte ce curseur pour la pagination suivante.
   Comme les deux passent par le MÊME code, le classement est identique : la 1re
   vidéo affichée est exactement celle classée en tête (alignement garanti). */

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import { generateThumbnailURL } from '../../../lib/cloudinary'
import { getSeenVideos } from '../../../lib/feed'
import { getBlockedUserIds } from '../../../lib/blockService'
import { rankVideos, EMPTY_TASTE, type UserTaste } from './rankVideos'
import { buildUserTaste } from './userTaste'
import type { Video } from '../../../types'

const PAGE_SIZE = 60
const MIN_KEEP = 5
const MAX_EXTRA_FETCHES = 3

export interface FeedPage {
  videos: Video[]
  isFirst: boolean
  hasMore: boolean
}

function mapDocToVideo(d: QueryDocumentSnapshot): Video {
  const data = d.data() as any
  return {
    id: d.id,
    userId: data.userId,
    userName: data.userName ?? undefined,
    userPhotoURL: data.userPhotoURL ?? undefined,
    videoURL: data.videoURL,
    videoURL_360p: data.videoURL_360p,
    videoURL_480p: data.videoURL_480p,
    thumbnailURL: (data.thumbnailURL as string | null)
      ?? generateThumbnailURL(data.videoURL as string)
      ?? undefined,
    description: data.description || '',
    hashtags: data.hashtags || [],
    likes: data.likes ?? 0,
    comments: data.comments ?? 0,
    shares: data.shares ?? 0,
    saves: data.saves ?? 0,
    reposts: data.reposts ?? 0,
    repostedBy: data.repostedBy ?? undefined,
    latestRepostedBy: data.latestRepostedBy ?? undefined,
    savedBy: data.savedBy ?? undefined,
    previewComments: data.previewComments ?? undefined,
    soundId: data.soundId,
    type: data.type || 'video',
    views: data.views ?? 0,
    likedBy: data.likedBy || [],
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
  }
}

class ForYouFeedSource {
  private lastDoc: QueryDocumentSnapshot | null = null
  private isFirstFetch = true
  private loading = false
  private seen = new Set<string>()
  private seenLoaded = false
  private extraFetches = 0
  private taste: UserTaste = EMPTY_TASTE
  private tasteLoaded = false
  private recentCreators: string[] = []
  private hasMore = true

  get hasMoreValue(): boolean {
    return this.hasMore
  }

  get isLoading(): boolean {
    return this.loading
  }

  /** Réinitialise complètement la source (pull-to-refresh, logout/login). */
  reset() {
    this.lastDoc = null
    this.isFirstFetch = true
    this.loading = false
    this.seen = new Set()
    this.seenLoaded = false
    this.extraFetches = 0
    this.taste = EMPTY_TASTE
    this.tasteLoaded = false
    this.recentCreators = []
    this.hasMore = true
  }

  /** Récupère la prochaine page classée. Renvoie null si aucun fetch n'a lieu
   *  (déjà en cours, ou plus rien à charger). isFirst indique s'il s'agit de la
   *  toute 1re page (→ setVideos) ou d'une page suivante (→ appendVideos). */
  async fetchNext(): Promise<FeedPage | null> {
    if (this.loading || !this.hasMore) return null
    this.loading = true

    try {
      if (!this.seenLoaded) {
        this.seen = new Set(await getSeenVideos())
        this.seenLoaded = true
      }
      const blockedIds = await getBlockedUserIds()
      if (!this.tasteLoaded) {
        this.taste = await buildUserTaste()
        this.tasteLoaded = true
      }

      // Boucle « extra fetches » : si une page donne trop peu de vidéos gardées
      // (beaucoup de vues/bloquées), on enchaîne des pages jusqu'à MIN_KEEP.
      let collected: Video[] = []
      while (true) {
        // hotScore servi par le serveur ; fallback createdAt si champ absent.
        let constraints: any[] = [orderBy('hotScore', 'desc'), limit(PAGE_SIZE)]
        if (this.lastDoc) constraints.push(startAfter(this.lastDoc))
        let q = query(collection(db, 'videos'), ...constraints)
        let snap = await getDocs(q)

        if (snap.empty && !this.lastDoc) {
          constraints = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE)]
          q = query(collection(db, 'videos'), ...constraints)
          snap = await getDocs(q)
        }

        if (snap.empty) {
          this.hasMore = false
          break
        }

        this.lastDoc = snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot
        this.hasMore = snap.docs.length >= PAGE_SIZE

        for (const d of snap.docs) {
          const data = d.data() as any
          if (data.corrupted) continue
          if (data.moderationStatus === 'hidden') continue
          if (this.seen.has(d.id)) continue
          if (blockedIds.has(data.userId)) continue
          collected.push(mapDocToVideo(d as QueryDocumentSnapshot))
        }

        if (
          collected.length < MIN_KEEP &&
          this.hasMore &&
          this.extraFetches < MAX_EXTRA_FETCHES
        ) {
          this.extraFetches++
          continue
        }
        break
      }

      if (collected.length === 0) {
        return { videos: [], isFirst: this.isFirstFetch, hasMore: this.hasMore }
      }

      const ranked = rankVideos(collected, this.taste, this.recentCreators)
      this.recentCreators = ranked.slice(-3).map((v) => v.userId)

      const isFirst = this.isFirstFetch
      this.isFirstFetch = false
      return { videos: ranked, isFirst, hasMore: this.hasMore }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'forYouFeedSource.fetchNext' })
      return null
    } finally {
      this.loading = false
    }
  }
}

export const forYouFeedSource = new ForYouFeedSource()

/** Amorce la 1re page pendant le démarrage. Idempotent : si déjà amorcée
 *  (isFirstFetch consommé), renvoie null sans refetch. */
export async function primeForYouFeed(): Promise<FeedPage | null> {
  return forYouFeedSource.fetchNext()
}
