/* useCurrentUserProfile.ts — Profil complet de l'utilisateur courant.

   Lit le document Firestore users/{uid} (source de vérité, pas Auth).
   Retourne le nom complet (nom) et la photo, en abonnement temps réel. */

import { useEffect, useState } from 'react'
import { doc, onSnapshot, type QueryDocumentSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

interface UserProfile {
  nom: string
  photoURL: string | null
}

const FALLBACK_NAME = 'Utilisateur'

export function useCurrentUserProfile(): UserProfile {
  const [profile, setProfile] = useState<UserProfile>({
    nom: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || FALLBACK_NAME,
    photoURL: auth.currentUser?.photoURL ?? null,
  })

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return

    return onSnapshot(
      doc(db, 'users', uid),
      (snap: QueryDocumentSnapshot) => {
        const data = snap.data()
        setProfile({
          nom: data?.nom || data?.pseudo || auth.currentUser?.displayName || FALLBACK_NAME,
          photoURL: data?.photoURL ?? auth.currentUser?.photoURL ?? null,
        })
      },
      () => {
        setProfile({
          nom: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || FALLBACK_NAME,
          photoURL: auth.currentUser?.photoURL ?? null,
        })
      },
    )
  }, [])

  return profile
}
