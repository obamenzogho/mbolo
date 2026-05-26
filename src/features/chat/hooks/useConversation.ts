import { useState, useEffect } from 'react'
import {
  doc, collection, query, orderBy, onSnapshot, limit as limitQuery,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Conversation, Message } from '@/types'

export function useConversation(conversationId: string | undefined) {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!conversationId) return

    const unsubConv = onSnapshot(
      doc(db, 'conversations', conversationId),
      (snap: any) => {
        if (snap.exists()) {
          setConversation({ id: snap.id, ...snap.data() } as Conversation)
        }
      },
    )

    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'asc'),
      limitQuery(100),
    )
    const unsubMsgs = onSnapshot(q, (snap: any) => {
      const items = snap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
      })) as Message[]
      setMessages(items)
      setLoading(false)
    })

    return () => {
      unsubConv()
      unsubMsgs()
    }
  }, [conversationId])

  return { conversation, messages, loading }
}
