import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, onSnapshot, orderBy, getDoc, doc } from 'firebase/firestore'
import { db, auth } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import type { Story } from '../../../hooks/useStories'

// Cache pour les settings de privacy des auteurs ( évite les lectures répétées ).
const privacyCache = new Map<string, { storyAudience: string; storyExcludedUsers: string[] }>()

async function getPrivacy(uid: string): Promise<{ storyAudience: string; storyExcludedUsers: string[] }> {
  const cached = privacyCache.get(uid)
  if (cached) return cached
  try {
    // La sous-collection settings est owner-only dans les rules. On ne peut PAS
    // la lire depuis un autre appareil. Donc on se base sur le doc user public :
    // le champ `privateAccount` indique si le compte est privé (= abonnés uniquement).
    // Pour le filtrage granulaire (exclusion), il faudrait un Cloud Function qui
    // dénormalise les settings sur le doc user ou sur les stories. Pour l'instant,
    // on utilise `privateAccount` comme proxy pour `storyAudience`.
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) {
      const data = snap.data() as any
      const result = {
        storyAudience: data.privateAccount ? 'followers' : 'everyone',
        storyExcludedUsers: data.storyExcludedUsers || [],
      }
      privacyCache.set(uid, result)
      return result
    }
  } catch { /* ignore */ }
  return { storyAudience: 'everyone', storyExcludedUsers: [] }
}

export interface StoryGroup {
  userId: string
  username: string
  avatarUrl: string
  stories: Story[]
  hasUnseen: boolean
  firstUnseenIndex: number
  latestAt: number
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function dateMs(value: any): number {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  return new Date(value).getTime()
}

export function useStoriesFeed(followingIds: string[]) {
  const uid = auth.currentUser?.uid ?? ''
  const [rawStories, setRawStories] = useState<Record<string, Story[]>>({})
  const [loading, setLoading] = useState(true)
  const [privacyMap, setPrivacyMap] = useState<Map<string, { storyAudience: string; storyExcludedUsers: string[] }>>(new Map())

  const targetIds = useMemo(() => {
    const set = new Set<string>([uid, ...followingIds].filter(Boolean))
    return Array.from(set)
  }, [uid, followingIds])

  useEffect(() => {
    if (targetIds.length === 0) { setLoading(false); return }
    setLoading(true)

    const groups = chunk(targetIds, 30)
    const perChunk: Record<number, Story[]> = {}
    let settled = 0

    const unsubs = groups.map((ids, chunkIdx) => {
      const q = query(
        collection(db, 'stories'),
        where('userId', 'in', ids),
        orderBy('createdAt', 'desc'),
      )
      return onSnapshot(
        q,
        (snap: any) => {
          const list: Story[] = []
          snap.forEach((d: any) => {
            const data = d.data() as any
            const expMs = data.expiresAt?.toMillis
              ? data.expiresAt.toMillis()
              : data.expiresAt?.seconds
                ? data.expiresAt.seconds * 1000
                : new Date(data.expiresAt).getTime()
            if (expMs > Date.now() && data.moderationStatus !== 'hidden') {
              list.push({ id: d.id, ...data } as Story)
            }
          })
          perChunk[chunkIdx] = list
          const byUser: Record<string, Story[]> = {}
          Object.values(perChunk).flat().forEach((s) => {
            ;(byUser[s.userId] ||= []).push(s)
          })
          setRawStories(byUser)
          settled++
          if (settled >= groups.length) setLoading(false)
        },
        (err: any) => {
          captureException(err instanceof Error ? err : new Error(String(err)), { context: 'useStoriesFeed' })
          settled++
          if (settled >= groups.length) setLoading(false)
        },
      )
    })

    return () => unsubs.forEach((u) => u())
  }, [targetIds])

  // Fetch privacy settings for all story authors
  useEffect(() => {
    const userIds = Object.keys(rawStories).filter(id => id !== uid)
    if (userIds.length === 0) return

    let cancelled = false
    Promise.allSettled(userIds.map(id => getPrivacy(id))).then(results => {
      if (cancelled) return
      const map = new Map(privacyMap)
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') map.set(userIds[i], r.value)
      })
      setPrivacyMap(map)
    })
    return () => { cancelled = true }
  }, [Object.keys(rawStories).join(','), uid])

  const groups = useMemo<StoryGroup[]>(() => {
    const out: StoryGroup[] = []

    for (const [userId, stories] of Object.entries(rawStories)) {
      if (!stories.length) continue

      // Privacy filtering: check if this author's stories should be visible
      if (userId !== uid) {
        const settings = privacyMap.get(userId)
        if (settings?.storyAudience === 'nobody') continue
        if (settings?.storyExcludedUsers?.includes(uid)) continue
      }

      const ordered = [...stories].sort(
        (a, b) => dateMs(a.createdAt) - dateMs(b.createdAt),
      )

      const firstUnseen = ordered.findIndex(
        (story) => !(story.viewedBy ?? []).includes(uid),
      )

      out.push({
        userId,
        username: ordered[0].username,
        avatarUrl: ordered[0].avatarUrl,
        stories: ordered,
        hasUnseen: firstUnseen !== -1,
        firstUnseenIndex: firstUnseen === -1 ? 0 : firstUnseen,
        latestAt: Math.max(...ordered.map((story) => dateMs(story.createdAt))),
      })
    }

    return out.sort((a, b) => {
      if (a.userId === uid) return -1
      if (b.userId === uid) return 1
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1
      return b.latestAt - a.latestAt
    })
  }, [rawStories, uid, privacyMap])

  return { groups, loading }
}
