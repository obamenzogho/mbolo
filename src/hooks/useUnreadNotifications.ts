import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

export function useUnreadNotifications() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', uid),
      where('read', '==', false),
    )
    const unsub = onSnapshot(q, (snap) => setCount(snap.size), () => setCount(0))
    return unsub
  }, [])

  return count
}
