import { useState, useEffect } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function useOnlineStatus(userId: string | null | undefined): boolean {
  const [online, setOnline] = useState(false)

  useEffect(() => {
    if (!userId) {
      setOnline(false)
      return
    }
    const unsub = onSnapshot(doc(db, 'users', userId), (snap: any) => {
      if (snap.exists()) {
        setOnline(!!snap.data().online)
      }
    })
    return () => unsub()
  }, [userId])

  return online
}
