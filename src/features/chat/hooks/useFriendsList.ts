import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'

export interface FriendUser {
  id: string
  pseudo: string
  nom?: string
  photoURL?: string
}

export function useFriendsList() {
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const currentUid = auth.currentUser?.uid
    if (!currentUid) return

    setLoading(true)

    const fetchFriends = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', currentUid))
        if (!snap.exists()) {
          setLoading(false)
          return
        }
        const data = snap.data()
        const following: string[] = data.following ?? []
        const followers: string[] = data.followers ?? []

        const friendIds = following.filter(id => followers.includes(id)).slice(0, 30)

        if (friendIds.length === 0) {
          setFriends([])
          setLoading(false)
          return
        }

        const friendDocs = await Promise.all(
          friendIds.map(id => getDoc(doc(db, 'users', id)))
        )

        const friendUsers: FriendUser[] = friendDocs
          .filter(d => d.exists())
          .map(d => ({
            id: d.id,
            pseudo: d.data()?.pseudo ?? '',
            nom: d.data()?.nom,
            photoURL: d.data()?.photoURL,
          }))

        setFriends(friendUsers)
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'useFriendsList' })
      }
      setLoading(false)
    }

    fetchFriends()
  }, [])

  return { friends, loading }
}
