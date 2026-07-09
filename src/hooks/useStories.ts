import { useState, useEffect, useCallback } from 'react'
import {
  collection, addDoc, doc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, serverTimestamp, increment, arrayUnion,
} from 'firebase/firestore'
import { db, auth } from '../lib/firebase'
import { uploadToCloudinary } from '../lib/cloudinary'
import { captureException } from '../lib/sentry'

export interface Story {
  id: string
  userId: string
  username: string
  avatarUrl: string
  mediaUrl: string
  mediaType: 'image' | 'video'
  caption?: string
  textOverlay?: string
  textPosition?: { x: number; y: number }
  createdAt: Date
  expiresAt: Date
  savedToHighlight: boolean
  views: number
  viewedBy: string[]
}

/**
 * Hook pour gérer les stories
 * - Upload vers Cloudinary + Firestore
 * - Suppression (Storage + Firestore)
 * - Récupération des stories actives
 * - Marquer comme vue
 * - Nettoyage automatique des stories expirées
 */
export function useStories() {
  const user = auth.currentUser
  const [myStories, setMyStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(false)

  /**
   * Upload un média vers Cloudinary et crée le document story
   */
  const uploadStory = useCallback(async (
    mediaUri: string,
    mediaType: 'image' | 'video',
    caption?: string,
    textOverlay?: string,
    textPosition?: { x: number; y: number }
  ): Promise<string> => {
    if (!user) throw new Error('Non authentifié')

    const isVideo = mediaType === 'video'

    const mediaUrl = await uploadToCloudinary(mediaUri, isVideo ? 'video' : 'image', {
      folder: 'stories',
      timeout: 120000,
    })

    // 2. Créer le document dans Firestore
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24h

    const storyDoc = await addDoc(collection(db, 'stories'), {
      userId: user.uid,
      username: user.displayName || 'Utilisateur',
      avatarUrl: user.photoURL || '',
      mediaUrl,
      mediaType,
      caption: caption || '',
      textOverlay: textOverlay || '',
      textPosition: textPosition || { x: 0, y: 0 },
      createdAt: serverTimestamp(),
      expiresAt,
      savedToHighlight: false,
      views: 0,
      viewedBy: [],
    })

    return storyDoc.id
  }, [user])

  /**
   * Supprime une story (Cloudinary + Firestore)
   */
  const deleteStory = useCallback(async (storyId: string) => {
    try {
      // Récupérer le document pour avoir mediaUrl
      const storyRef = doc(db, 'stories', storyId)
      const snap = await getDocs(query(collection(db, 'stories'), where('__name__', '==', storyId)))
      if (!snap.empty) {
        const data = snap.docs[0].data()
        // Supprimer de Cloudinary (extraction du public_id)
        if (data.mediaUrl) {
          const parts = data.mediaUrl.split('/')
          const filename = parts[parts.length - 1]
          const publicId = `stories/${filename.split('.')[0]}`
          // Note: Cloudinary delete via API nécessite une clé secrète côté serveur
          // On supprime juste le document Firestore
        }
      }
      await deleteDoc(storyRef)
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteStory' })
      console.error('deleteStory error:', e)
    }
  }, [])

  /**
   * Récupère les stories non expirées d'un utilisateur
   */
  const getUserStories = useCallback(async (userId: string): Promise<Story[]> => {
    try {
      const q = query(
        collection(db, 'stories'),
        where('userId', '==', userId)
      )
      const snap = await getDocs(q)
      const now = new Date()
      return snap.docs
        .map((d: any) => ({ id: d.id, ...d.data() } as Story))
        .filter((s: Story) => s.expiresAt && new Date(s.expiresAt) > now)
        .sort((a: Story, b: Story) => {
          const aTime = (a.createdAt as any)?.seconds || 0
          const bTime = (b.createdAt as any)?.seconds || 0
          return bTime - aTime
        })
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getUserStories' })
      console.error('getUserStories error:', e)
      return []
    }
  }, [])

  /**
   * Récupère mes stories non expirées
   */
  const getMyStories = useCallback(async (): Promise<Story[]> => {
    if (!user) return []
    return getUserStories(user.uid)
  }, [user, getUserStories])

  /**
   * Récupère les viewers d'une story par leurs IDs
   */
  const getStoryViewers = useCallback(async (viewerIds: string[]): Promise<{ uid: string; displayName: string; photoURL: string }[]> => {
    const results: { uid: string; displayName: string; photoURL: string }[] = []
    for (const uid of viewerIds) {
      try {
        const snap = await getDoc(doc(db, 'users', uid))
        if (snap.exists()) {
          const d = snap.data()
          results.push({ uid, displayName: d.displayName ?? d.username ?? '?', photoURL: d.photoURL ?? '' })
        }
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'getStoryViewers', uid })
      }
    }
    return results
  }, [])

  /**
   * Marque une story comme vue par un utilisateur
   */
  const markAsViewed = useCallback(async (storyId: string, viewerId: string) => {
    try {
      const storyRef = doc(db, 'stories', storyId)
      await updateDoc(storyRef, {
        views: increment(1),
        viewedBy: arrayUnion(viewerId),
      })
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'markAsViewed' })
      console.error('markAsViewed error:', e)
    }
  }, [])

  /**
   * Nettoie les stories expirées non sauvegardées
   */
  const cleanExpiredStories = useCallback(async () => {
    if (!user) return
    try {
      const q = query(
        collection(db, 'stories'),
        where('userId', '==', user.uid)
      )
      const snap = await getDocs(q)
      const now = new Date()
      for (const d of snap.docs as any[]) {
        const data = d.data() as Story
        if (new Date(data.expiresAt) < now && !data.savedToHighlight) {
          await deleteDoc(doc(db, 'stories', d.id))
        }
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'cleanExpiredStories' })
      console.error('cleanExpiredStories error:', e)
    }
  }, [user])

  // Charger mes stories au montage
  useEffect(() => {
    if (user) {
      setLoading(true)
      getMyStories().then(stories => {
        setMyStories(stories)
        setLoading(false)
      })
      // Nettoyage automatique
      cleanExpiredStories()
    }
  }, [user, getMyStories, cleanExpiredStories])

  return {
    myStories,
    loading,
    uploadStory,
    deleteStory,
    getMyStories,
    getUserStories,
    getStoryViewers,
    markAsViewed,
    cleanExpiredStories,
  }
}
