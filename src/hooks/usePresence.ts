import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

async function setOnline(online: boolean) {
  const uid = auth.currentUser?.uid
  if (!uid) return
  try {
    await updateDoc(doc(db, 'users', uid), {
      online,
      lastSeen: serverTimestamp(),
    })
  } catch {
  }
}

export function usePresence() {
  const prevStateRef = useRef<string>('active')
  const initialRef = useRef(false)

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user: any) => {
      if (user && !initialRef.current) {
        initialRef.current = true
        setOnline(true)
      } else if (!user) {
        initialRef.current = false
      }
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = prevStateRef.current
      prevStateRef.current = nextState

      if (prev === 'active' && nextState.match(/inactive|background/)) {
        setOnline(false)
      } else if (prev.match(/inactive|background/) && nextState === 'active') {
        setOnline(true)
      }
    })

    return () => {
      sub.remove()
      setOnline(false)
    }
  }, [])
}
