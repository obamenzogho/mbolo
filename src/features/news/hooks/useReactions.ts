/* useReactions — hook pour gérer les réactions sur un post.
   Abonnement temps réel à posts/{postId}/reactions/{uid}.
   Toggle optimiste avec rollback (même pattern que toggleLike). */

import { useState, useEffect, useCallback } from 'react'
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import type { PostReactionType } from '../types'

export function useReactions(postId: string, currentUserId: string) {
  const [myReaction, setMyReaction] = useState<PostReactionType | null>(null)

  // Abonnement temps réel à la réaction de l'utilisateur
  useEffect(() => {
    if (!postId || !currentUserId) return
    const ref = doc(db, 'posts', postId, 'reactions', currentUserId)
    const unsub = onSnapshot(
      ref,
      (snap: any) => {
        if (snap.exists()) {
          setMyReaction(snap.data().type as PostReactionType)
        } else {
          setMyReaction(null)
        }
      },
      (err: any) => {
        captureException(err, { context: 'useReactions snapshot', postId })
      },
    )
    return unsub
  }, [postId, currentUserId])

  const toggleReaction = useCallback(
    async (type: PostReactionType = 'like') => {
      if (!currentUserId) return

      const ref = doc(db, 'posts', postId, 'reactions', currentUserId)
      const prevReaction = myReaction

      // Optimistic update
      if (prevReaction === type) {
        // Même type → supprimer la réaction
        setMyReaction(null)
        try {
          await deleteDoc(ref)
        } catch (e) {
          setMyReaction(prevReaction) // Rollback
          captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteReaction' })
        }
      } else if (prevReaction) {
        // Type différent → mettre à jour
        setMyReaction(type)
        try {
          await setDoc(ref, { type, userId: currentUserId, createdAt: serverTimestamp() }, { merge: true })
        } catch (e) {
          setMyReaction(prevReaction) // Rollback
          captureException(e instanceof Error ? e : new Error(String(e)), { context: 'updateReaction' })
        }
      } else {
        // Aucune réaction → créer
        setMyReaction(type)
        try {
          await setDoc(ref, { type, userId: currentUserId, createdAt: serverTimestamp() })
        } catch (e) {
          setMyReaction(null) // Rollback
          captureException(e instanceof Error ? e : new Error(String(e)), { context: 'createReaction' })
        }
      }
    },
    [postId, currentUserId, myReaction],
  )

  return { myReaction, toggleReaction }
}
