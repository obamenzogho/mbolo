/* src/features/news/hooks/useActiveStories.ts
   Anneau de story sur l'en-tête des posts : retourne le Set des auteurs ayant
   au moins une story non expirée. Un seul getDocs groupé par page de fil
   (pas d'onSnapshot, pas de boucle de lecture par carte) ; l'index composé
   `stories userId ASC + expiresAt ASC` existe déjà dans firestore.indexes.json. */

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'

/** `in` est plafonné à 30 valeurs par Firestore. */
const IN_LIMIT = 30

function toMillis(value: unknown): number {
  if (!value) return 0
  if (typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime()
  }
  return new Date(value as string | number).getTime()
}

export function useActiveStories(userIds: string[]): Set<string> {
  const [active, setActive] = useState<Set<string>>(() => new Set())

  const ids = useMemo(
    () => Array.from(new Set(userIds.filter(Boolean))).slice(0, IN_LIMIT),
    [userIds],
  )

  useEffect(() => {
    if (ids.length === 0) {
      setActive(new Set())
      return
    }

    let cancelled = false
    const now = Date.now()

    const batches: string[][] = []
    for (let i = 0; i < ids.length; i += IN_LIMIT) {
      batches.push(ids.slice(i, i + IN_LIMIT))
    }

    void (async () => {
      const found = new Set<string>()

      for (const batch of batches) {
        try {
          const snap = await getDocs(
            query(
              collection(db, 'stories'),
              where('userId', 'in', batch),
              where('expiresAt', '>', new Date(now)),
              limit(100),
            ),
          )
          if (cancelled) return
          snap.docs.forEach((storyDoc: QueryDocumentSnapshot) => {
            const data = storyDoc.data()
            if (toMillis(data.expiresAt) > now && data.moderationStatus !== 'hidden') {
              found.add(data.userId as string)
            }
          })
        } catch (error) {
          captureException(error instanceof Error ? error : new Error(String(error)), {
            context: 'useActiveStories',
          })
        }
      }

      if (!cancelled) setActive(found)
    })()

    return () => {
      cancelled = true
    }
  }, [ids])

  return active
}
