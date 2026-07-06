import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'

export function useUsernameCheck(pseudo: string, currentPseudo: string) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')

  useEffect(() => {
    const normalized = pseudo.trim().toLowerCase()
    if (normalized === currentPseudo.toLowerCase()) { setStatus('idle'); return }
    if (normalized.length < 3 || !/^[a-z0-9._]+$/.test(normalized)) { setStatus('invalid'); return }

    setStatus('checking')
    const timer = setTimeout(async () => {
      const snap = await getDoc(doc(db, 'usernames', normalized))
      setStatus(!snap.exists() || snap.data()?.uid === auth.currentUser?.uid ? 'available' : 'taken')
    }, 400)
    return () => clearTimeout(timer)
  }, [pseudo, currentPseudo])

  return status
}
