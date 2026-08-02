/* src/hooks/useCurrentUserPhoto.ts

   Photo de profil de l'utilisateur courant.

   `auth.currentUser.photoURL` ne suffit pas : l'écran d'édition de profil
   écrit dans `users/{uid}.photoURL`, et le profil Auth n'est pas toujours
   à jour derrière. La source de vérité est donc le document Firestore,
   avec Auth en repli — même précédence que la barre d'onglets du bas.

   En abonnement plutôt qu'en lecture unique : changer son avatar doit se
   voir immédiatement partout, sans remonter l'écran. */

import { useEffect, useState } from 'react'
import { doc, onSnapshot, type QueryDocumentSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

export function useCurrentUserPhoto(): string | null {
  const [photoURL, setPhotoURL] = useState<string | null>(
    auth.currentUser?.photoURL ?? null,
  )

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return

    return onSnapshot(
      doc(db, 'users', uid),
      (snap: QueryDocumentSnapshot) => {
        const data = snap.data()
        setPhotoURL(data?.photoURL ?? auth.currentUser?.photoURL ?? null)
      },
      () => {
        setPhotoURL(auth.currentUser?.photoURL ?? null)
      },
    )
  }, [])

  return photoURL
}
