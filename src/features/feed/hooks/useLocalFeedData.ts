/* useLocalFeedData — feed « près de chez toi » (onglet ville).
   Rôle : récupère les vidéos géolocalisées dans un rayon autour de l'utilisateur
   via geohashQueryBounds (geofire-common), affine par distance réelle, élargit
   le rayon (25→50→100 km) si trop peu de résultats, puis COMPLÈTE avec les
   vidéos tendance générales pour ne jamais afficher une page vide.
   Retour aligné sur useFeedData : { videos, isLoadingMore, hasMore, refresh }. */

import { useCallback, useEffect, useRef } from 'react'
import {
  collection, query, where, orderBy, limit, getDocs,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { geohashQueryBounds, distanceBetween } from 'geofire-common'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import { db } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import { generateThumbnailURL } from '../../../lib/cloudinary'
import { getBlockedUserIds } from '../../../lib/blockService'
import { rankVideos, EMPTY_TASTE, type UserTaste } from '../services/rankVideos'
import { buildUserTaste } from '../services/userTaste'
import type { Video } from '../../../types'
import type { FeedState } from '../store/feedStore'
import type { Place } from '../../location/useUserLocation'

const RADII_KM = [25, 50, 100]
const MIN_LOCAL = 8          // en dessous, on élargit le rayon puis on complète
const PER_BOUND = 40         // limite par borne geohash
const FALLBACK_SIZE = 40     // vidéos tendance de complément

function mapDoc(d: QueryDocumentSnapshot): Video {
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
    place: data.place ?? undefined,
    lat: data.lat ?? undefined,
    lng: data.lng ?? undefined,
    geohash: data.geohash ?? undefined,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
  }
}

function passesModeration(data: any): boolean {
  return !data.corrupted && data.moderationStatus !== 'hidden'
}

export function useLocalFeedData(
  { store, place }: { store: StoreApi<FeedState>; place: Place | null },
) {
  const loadingRef = useRef(false)
  const fetchedForRef = useRef<string | null>(null) // geohash déjà chargé
  const tasteRef = useRef<UserTaste>(EMPTY_TASTE)
  const tasteLoadedRef = useRef(false)

  const videos = useStore(store, (s) => s.videos)
  const isLoadingMore = useStore(store, (s) => s.isLoadingMore)
  const hasMore = useStore(store, (s) => s.hasMore)
  const setVideos = useStore(store, (s) => s.setVideos)
  const setLoadingMore = useStore(store, (s) => s.setLoadingMore)
  const setHasMore = useStore(store, (s) => s.setHasMore)

  // Requête de proximité pour un rayon donné → vidéos filtrées par distance.
  const fetchWithinRadius = useCallback(async (center: [number, number], radiusKm: number, blocked: Set<string>) => {
    const bounds = geohashQueryBounds(center, radiusKm * 1000)
    const snaps = await Promise.all(
      bounds.map((b) =>
        getDocs(query(
          collection(db, 'videos'),
          orderBy('geohash'),
          where('geohash', '>=', b[0]),
          where('geohash', '<=', b[1]),
          limit(PER_BOUND),
        )),
      ),
    )
    const seen = new Set<string>()
    const out: Video[] = []
    for (const snap of snaps) {
      for (const d of snap.docs) {
        if (seen.has(d.id)) continue
        const data = d.data() as any
        if (!passesModeration(data)) continue
        if (blocked.has(data.userId)) continue
        if (typeof data.lat !== 'number' || typeof data.lng !== 'number') continue
        const distKm = distanceBetween(center, [data.lat, data.lng])
        if (distKm > radiusKm) continue
        seen.add(d.id)
        out.push(mapDoc(d as QueryDocumentSnapshot))
      }
    }
    return out
  }, [])

  // Complément : vidéos tendance générales (hotScore, fallback createdAt).
  const fetchTrending = useCallback(async (blocked: Set<string>, excludeIds: Set<string>) => {
    let snap = await getDocs(query(collection(db, 'videos'), orderBy('hotScore', 'desc'), limit(FALLBACK_SIZE)))
    if (snap.empty) {
      snap = await getDocs(query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(FALLBACK_SIZE)))
    }
    const out: Video[] = []
    for (const d of snap.docs) {
      if (excludeIds.has(d.id)) continue
      const data = d.data() as any
      if (!passesModeration(data)) continue
      if (blocked.has(data.userId)) continue
      out.push(mapDoc(d as QueryDocumentSnapshot))
    }
    return out
  }, [])

  const load = useCallback(async () => {
    if (!place || loadingRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    try {
      const blocked = await getBlockedUserIds()
      if (!tasteLoadedRef.current) {
        tasteRef.current = await buildUserTaste()
        tasteLoadedRef.current = true
      }

      const center: [number, number] = [place.lat, place.lng]

      // Élargissement progressif du rayon jusqu'à atteindre MIN_LOCAL.
      let local: Video[] = []
      for (const radiusKm of RADII_KM) {
        local = await fetchWithinRadius(center, radiusKm, blocked)
        if (local.length >= MIN_LOCAL) break
      }

      const localIds = new Set(local.map((v) => v.id))
      const localRanked = rankVideos(local, tasteRef.current, [])

      // Complément tendances si le local est maigre → jamais de page vide.
      let combined = localRanked
      if (local.length < MIN_LOCAL) {
        const trending = await fetchTrending(blocked, localIds)
        combined = [...localRanked, ...rankVideos(trending, tasteRef.current, [])]
      }

      setVideos(combined)
      setHasMore(false) // feed borné (proximité + complément), pas de pagination infinie
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useLocalFeedData' })
      setHasMore(false)
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }, [place, fetchWithinRadius, fetchTrending, setVideos, setLoadingMore, setHasMore])

  // (Re)charge quand la position devient connue ou change de zone.
  useEffect(() => {
    if (!place) return
    if (fetchedForRef.current === place.geohash) return
    fetchedForRef.current = place.geohash
    load()
  }, [place, load])

  const refresh = useCallback(() => {
    fetchedForRef.current = null
    tasteLoadedRef.current = false
    setHasMore(true)
    load()
  }, [load, setHasMore])

  return {
    videos,
    isLoadingMore,
    hasMore,
    isEmpty: !place,
    loadMore: () => {},
    refresh,
  }
}
