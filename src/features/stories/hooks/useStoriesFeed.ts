/* useStoriesFeed — flux stories temps réel, façon WhatsApp.
   - Écoute mes stories + celles des gens que je suis (array `following` sur le user doc).
   - onSnapshot chunké par 30 (limite Firestore `in`).
   - Regroupe par user, trie non-vus d'abord puis par récence.
   - Calcule le 1er index non-vu par groupe (reprise "là où t'en étais"). */

import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db, auth } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import type { Story } from '../../../hooks/useStories'

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

const MOCK_STORIES: Record<string, Story[]> = {
  mock_user_1: [
    { id: 'mock_1', userId: 'mock_user_1', username: 'Sophie', avatarUrl: 'https://i.pravatar.cc/150?u=sophie', mediaUrl: 'https://picsum.photos/seed/story1/400/700', mediaType: 'image', createdAt: new Date(Date.now() - 1000 * 60 * 30), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 23), savedToHighlight: false, views: 12, viewedBy: [] },
    { id: 'mock_2', userId: 'mock_user_1', username: 'Sophie', avatarUrl: 'https://i.pravatar.cc/150?u=sophie', mediaUrl: 'https://picsum.photos/seed/story2/400/700', mediaType: 'image', caption: 'Magnifique coucher de soleil 🌅', createdAt: new Date(Date.now() - 1000 * 60 * 15), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 23), savedToHighlight: false, views: 8, viewedBy: [] },
  ],
  mock_user_2: [
    { id: 'mock_3', userId: 'mock_user_2', username: 'Lucas', avatarUrl: 'https://i.pravatar.cc/150?u=lucas', mediaUrl: 'https://picsum.photos/seed/story3/400/700', mediaType: 'image', caption: 'Nouveau chapitre 🚀', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 22), savedToHighlight: false, views: 25, viewedBy: ['mock_user_1'] },
    { id: 'mock_4', userId: 'mock_user_2', username: 'Lucas', avatarUrl: 'https://i.pravatar.cc/150?u=lucas', mediaUrl: 'https://picsum.photos/seed/story4/400/700', mediaType: 'image', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 23), savedToHighlight: false, views: 18, viewedBy: [] },
  ],
  mock_user_3: [
    { id: 'mock_5', userId: 'mock_user_3', username: 'Emma', avatarUrl: 'https://i.pravatar.cc/150?u=emma', mediaUrl: 'https://picsum.photos/seed/story5/400/700', mediaType: 'image', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 20), savedToHighlight: false, views: 42, viewedBy: ['mock_user_1', 'mock_user_2'] },
    { id: 'mock_6', userId: 'mock_user_3', username: 'Emma', avatarUrl: 'https://i.pravatar.cc/150?u=emma', mediaUrl: 'https://picsum.photos/seed/story6/400/700', mediaType: 'image', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 21), savedToHighlight: false, views: 30, viewedBy: [] },
  ],
}

export function useStoriesFeed(followingIds: string[]) {
  const uid = auth.currentUser?.uid ?? ''
  const [rawStories, setRawStories] = useState<Record<string, Story[]>>({})
  const [loading, setLoading] = useState(true)

  const targetIds = useMemo(() => {
    const set = new Set<string>([uid, ...followingIds].filter(Boolean))
    return Array.from(set)
  }, [uid, followingIds])

  useEffect(() => {
    if (targetIds.length === 0) { setLoading(false); return }
    setLoading(true)

    const now = Date.now()
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
            const expMs = data.expiresAt?.seconds
              ? data.expiresAt.seconds * 1000
              : new Date(data.expiresAt).getTime()
            if (expMs && expMs > now) {
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

  const groups = useMemo<StoryGroup[]>(() => {
    const merged = { ...rawStories }
    for (const [mockUid, mockStories] of Object.entries(MOCK_STORIES)) {
      if (!merged[mockUid]) merged[mockUid] = mockStories
    }
    if (!merged[uid]) {
      merged[uid] = [
        { id: 'mock_me_1', userId: uid, username: 'Moi', avatarUrl: auth.currentUser?.photoURL || 'https://i.pravatar.cc/150?u=me', mediaUrl: 'https://picsum.photos/seed/mystory1/400/700', mediaType: 'image', caption: 'Ma story du jour!', createdAt: new Date(Date.now() - 1000 * 60 * 5), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 23), savedToHighlight: false, views: 3, viewedBy: ['mock_user_1', 'mock_user_2'] },
      ]
    }
    const out: StoryGroup[] = []
    for (const [userId, stories] of Object.entries(merged)) {
      if (!stories.length) continue
      const ordered = [...stories].sort((a, b) => {
        const at = (a.createdAt as any)?.seconds ?? 0
        const bt = (b.createdAt as any)?.seconds ?? 0
        return at - bt
      })
      const firstUnseen = ordered.findIndex((s) => !(s.viewedBy ?? []).includes(uid))
      const latestAt = Math.max(...ordered.map((s) => (s.createdAt as any)?.seconds ?? 0))
      out.push({
        userId,
        username: ordered[0].username,
        avatarUrl: ordered[0].avatarUrl,
        stories: ordered,
        hasUnseen: firstUnseen !== -1,
        firstUnseenIndex: firstUnseen === -1 ? 0 : firstUnseen,
        latestAt,
      })
    }
    return out.sort((a, b) => {
      if (a.userId === uid) return -1
      if (b.userId === uid) return 1
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1
      return b.latestAt - a.latestAt
    })
  }, [rawStories, uid])

  return { groups, loading }
}
