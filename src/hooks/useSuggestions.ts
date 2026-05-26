import { useState, useEffect } from 'react'
import { collection, getDocs, getDoc, doc, limit, query } from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import type { User } from '../types'

export function useSuggestions() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchSuggestions = async () => {
      const currentUid = auth.currentUser?.uid
      if (!currentUid) {
        setLoading(false)
        return
      }

      try {
        const userSnap = await getDoc(doc(db, 'users', currentUid))
        const following: string[] = userSnap.exists() ? userSnap.data().following || [] : []

        const snapshot = await getDocs(query(collection(db, 'users'), limit(20)))
        const allUsers = snapshot.docs
          .map((d: any) => ({ id: d.id, ...d.data() } as User))
          .filter((u: any) => u.id !== currentUid && !following.includes(u.id) && (u.nom || u.pseudo))
          .slice(0, 10)

        if (!cancelled) {
          setUsers(allUsers)
        }
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'fetchSuggestions' })
        if (!cancelled) setUsers([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchSuggestions()
    return () => { cancelled = true }
  }, [])

  return { users, loading }
}
