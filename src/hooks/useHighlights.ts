import { useState, useEffect, useCallback } from 'react'
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  query, where, orderBy, getDocs, serverTimestamp, increment, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { uploadToCloudinary } from '../lib/cloudinary'

export interface Highlight {
  id: string
  userId: string
  title: string
  coverUrl: string
  mediaUrls: string[]
  createdAt: Date
  storiesCount: number
  stories: string[]
}

/**
 * Hook pour gérer les highlights (mises en avant)
 * - CRUD complet
 * - Upload de cover vers Cloudinary
 * - Ajout/retrait de stories
 * - Réorganisation
 */
export function useHighlights(userId: string) {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(false)

  /**
   * Upload une image cover vers Cloudinary
   */
  const uploadCover = useCallback(async (uri: string): Promise<string | null> => {
    try {
      return await uploadToCloudinary(uri, 'image', { folder: 'highlights', timeout: 30000 })
    } catch {
      return null
    }
  }, [])

  /**
   * Récupère les highlights d'un utilisateur
   */
  const getHighlights = useCallback(async (uid: string = userId): Promise<Highlight[]> => {
    try {
      const q = query(
        collection(db, 'highlights'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc')
      )
      const snap = await getDocs(q)
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Highlight))
    } catch (e) {
      console.error('getHighlights error:', e)
      return []
    }
  }, [userId])

  /**
   * Crée un nouveau highlight avec une story
   */
  const createHighlight = useCallback(async (title: string, coverUri: string, storyId: string): Promise<string> => {
    const user = auth.currentUser
    if (!user) throw new Error('Non authentifié')

    // Upload de la cover
    const coverUrl = coverUri ? await uploadCover(coverUri) : ''

    // Créer le highlight
    const highlightRef = await addDoc(collection(db, 'highlights'), {
      userId: user.uid,
      title,
      coverUrl: coverUrl || '',
      mediaUrls: [],
      createdAt: serverTimestamp(),
      storiesCount: 1,
      stories: [storyId],
    })

    // Marquer la story comme sauvegardée
    await updateDoc(doc(db, 'stories', storyId), {
      savedToHighlight: true,
    })

    // Recharger les highlights
    const updated = await getHighlights(user.uid)
    setHighlights(updated)

    return highlightRef.id
  }, [uploadCover, getHighlights])

  /**
   * Ajoute une story à un highlight existant
   */
  const addToHighlight = useCallback(async (highlightId: string, storyId: string) => {
    // Récupérer la story pour avoir son mediaUrl
    const storySnap = await getDocs(query(collection(db, 'stories'), where('__name__', '==', storyId)))
    let mediaUrl = ''
    if (!storySnap.empty) {
      mediaUrl = storySnap.docs[0].data().mediaUrl || ''
    }

    await updateDoc(doc(db, 'highlights', highlightId), {
      stories: arrayUnion(storyId),
      mediaUrls: mediaUrl ? arrayUnion(mediaUrl) : arrayUnion(''),
      storiesCount: increment(1),
    })

    await updateDoc(doc(db, 'stories', storyId), {
      savedToHighlight: true,
    })

    // Recharger
    const user = auth.currentUser
    if (user) {
      const updated = await getHighlights(user.uid)
      setHighlights(updated)
    }
  }, [getHighlights])

  /**
   * Retire une story d'un highlight
   */
  const removeFromHighlight = useCallback(async (highlightId: string, storyId: string) => {
    await updateDoc(doc(db, 'highlights', highlightId), {
      stories: arrayRemove(storyId),
      storiesCount: increment(-1),
    })
  }, [])

  /**
   * Supprime un highlight (et retire le flag savedToHighlight des stories)
   */
  const deleteHighlight = useCallback(async (highlightId: string) => {
    try {
      // Récupérer les stories de cet highlight
      const snap = await getDocs(query(collection(db, 'highlights'), where('__name__', '==', highlightId)))
      if (!snap.empty) {
        const data = snap.docs[0].data()
        const storyIds = data.stories || []
        // Retirer le flag savedToHighlight
        for (const sid of storyIds) {
          try {
            await updateDoc(doc(db, 'stories', sid), { savedToHighlight: false })
          } catch { /* story peut déjà être supprimée */ }
        }
      }
      await deleteDoc(doc(db, 'highlights', highlightId))

      // Recharger
      const user = auth.currentUser
      if (user) {
        const updated = await getHighlights(user.uid)
        setHighlights(updated)
      }
    } catch (e) {
      console.error('deleteHighlight error:', e)
    }
  }, [getHighlights])

  /**
   * Met à jour la cover d'un highlight
   */
  const updateHighlightCover = useCallback(async (highlightId: string, coverUri: string) => {
    const coverUrl = await uploadCover(coverUri)
    if (coverUrl) {
      await updateDoc(doc(db, 'highlights', highlightId), { coverUrl })
      const user = auth.currentUser
      if (user) {
        const updated = await getHighlights(user.uid)
        setHighlights(updated)
      }
    }
  }, [uploadCover, getHighlights])

  /**
   * Modifie le titre d'un highlight
   */
  const updateHighlightTitle = useCallback(async (highlightId: string, title: string) => {
    await updateDoc(doc(db, 'highlights', highlightId), { title })
    const user = auth.currentUser
    if (user) {
      const updated = await getHighlights(user.uid)
      setHighlights(updated)
    }
  }, [getHighlights])

  /**
   * Réorganise les highlights (par ordre de createdAt modifié)
   * Note: Firestore ne supporte pas le réordonnancement direct,
   * on utilise un champ 'order' si besoin
   */
  const reorderHighlights = useCallback(async (newOrderIds: string[]) => {
    const batch = newOrderIds.map((id, index) =>
      updateDoc(doc(db, 'highlights', id), { order: index })
    )
    await Promise.all(batch)
    const user = auth.currentUser
    if (user) {
      const updated = await getHighlights(user.uid)
      setHighlights(updated)
    }
  }, [getHighlights])

  // Charger au montage
  useEffect(() => {
    if (userId) {
      setLoading(true)
      getHighlights(userId).then(hl => {
        setHighlights(hl)
        setLoading(false)
      })
    }
  }, [userId, getHighlights])

  return {
    highlights,
    loading,
    getHighlights,
    createHighlight,
    addToHighlight,
    removeFromHighlight,
    deleteHighlight,
    updateHighlightCover,
    updateHighlightTitle,
    reorderHighlights,
    uploadCover,
  }
}
