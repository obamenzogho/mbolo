import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, collection, query, where, orderBy, limit as firestoreLimit, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import type { ShareSuggestion } from '../types'

export function useShareSuggestions(postId?: string) {
  const [suggestions, setSuggestions] = useState<ShareSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const currentUserId = auth.currentUser?.uid

  const refresh = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)
    try {
      const userSnap = await getDoc(doc(db, 'users', currentUserId))
      const userData = userSnap.data()
      const following: string[] = userData?.following ?? []
      const followers: string[] = userData?.followers ?? []

      const friendIds = following.filter((id: string) => followers.includes(id)).slice(0, 20)

      const recentShareSenderIds = new Set<string>()
      if (postId) {
        const shareSnap = await getDocs(
          query(
            collection(db, 'shares'),
            where('postId', '==', postId),
            orderBy('createdAt', 'desc'),
            firestoreLimit(20),
          ),
        )
        shareSnap.docs.forEach((d) => {
          const data = d.data()
          if (data.receiverId && data.receiverId !== currentUserId) {
            recentShareSenderIds.add(data.receiverId)
          }
        })
      }

      const friendDocs = await Promise.all(
        friendIds.map((id: string) => getDoc(doc(db, 'users', id)).catch(() => null)),
      )

      const scored: ShareSuggestion[] = friendDocs
        .filter((d): d is NonNullable<typeof d> => d !== null && d.exists())
        .map((d) => {
          const data = d.data()
          let score = 50
          if (recentShareSenderIds.has(d.id)) score += 30
          return {
            userId: d.id,
            pseudo: data?.pseudo ?? '',
            nom: data?.nom,
            photoURL: data?.photoURL,
            score,
            reason: recentShareSenderIds.has(d.id) ? 'Partage récent' : 'Ami',
          } as ShareSuggestion
        })

      scored.sort((a, b) => b.score - a.score)
      setSuggestions(scored.slice(0, 15))
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useShareSuggestions' })
    }
    setLoading(false)
  }, [currentUserId, postId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { suggestions, loading, refresh }
}
