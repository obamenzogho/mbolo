import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, where, orderBy, onSnapshot, limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Conversation } from '@/types'

export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc'),
      limit(30),
    )
    const unsub = onSnapshot(q, (snap: any) => {
      const items = snap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
      })) as Conversation[]
      setConversations(items)
      setLoading(false)
    })
    return unsub
  }, [userId])

  const normal = useMemo(
    () => conversations.filter(
      (c) => !c.blockedBy?.includes(userId || '') && !c.spamFor?.includes(userId || '') && !c.deletedBy?.includes(userId || ''),
    ),
    [conversations, userId],
  )

  const spam = useMemo(
    () => conversations.filter((c) => c.spamFor?.includes(userId || '')),
    [conversations, userId],
  )

  const archived = useMemo(
    () => conversations.filter((c) => c.deletedBy?.includes(userId || '')),
    [conversations, userId],
  )

  return { conversations, normal, spam, archived, loading }
}
