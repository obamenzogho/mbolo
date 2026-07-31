import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

/* ─────────────────────────────────────────────────────────────
   RÉACTIONS DE POST — posts/{postId}/reactions/{userId}

   Le mobile écrit uniquement son intention dans la sous-collection
   (setDoc/deleteDoc). Ce module agrège les compteurs sur le document post
   (reactionCounts, likes, likedBy) — l'écriture directe du mobile y est
   interdite par firestore.rules.

   `getFirestore()` est appelé à l'intérieur des handlers : index.ts
   initialise l'app par défaut dans son corps de module.
   ───────────────────────────────────────────────────────────── */

export const onPostReactionCreate = onDocumentCreated(
  'posts/{postId}/reactions/{userId}',
  async (e) => {
    const type = e.data?.data()?.type
    if (!type) return

    const db = getFirestore()
    const postRef = db.doc(`posts/${e.params.postId}`)

    await postRef.update({
      [`reactionCounts.${type}`]: FieldValue.increment(1),
      [`reactionCounts.total`]: FieldValue.increment(1),
      likes: FieldValue.increment(1),
      likedBy: FieldValue.arrayUnion(e.params.userId),
    }).catch((err) => console.warn('onPostReactionCreate:', err?.message ?? err))

    // Notification à l'auteur du post
    const postSnap = await postRef.get().catch(() => null)
    const postData = postSnap?.data()
    if (postData?.userId && postData.userId !== e.params.userId) {
      await db.doc(`notifications/${db.collection('_').doc().id}`).set({
        userId: postData.userId,
        type: 'post_like',
        fromUserId: e.params.userId,
        postId: e.params.postId,
        text: '',
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      }).catch(() => {})
    }
  },
)

export const onPostReactionUpdate = onDocumentUpdated(
  'posts/{postId}/reactions/{userId}',
  async (e) => {
    const oldType = e.data?.before?.data()?.type
    const newType = e.data?.after?.data()?.type
    if (!oldType || !newType || oldType === newType) return

    await getFirestore().doc(`posts/${e.params.postId}`).update({
      [`reactionCounts.${oldType}`]: FieldValue.increment(-1),
      [`reactionCounts.${newType}`]: FieldValue.increment(1),
    }).catch((err) => console.warn('onPostReactionUpdate:', err?.message ?? err))
  },
)

export const onPostReactionDelete = onDocumentDeleted(
  'posts/{postId}/reactions/{userId}',
  async (e) => {
    // En v2, `event.data` EST le snapshot du document supprimé
    // (l'ancien accès `data.before` ne fonctionnait pas : compteur jamais
    // décrémenté à la suppression).
    const type = e.data?.data()?.type
    if (!type) return

    await getFirestore().doc(`posts/${e.params.postId}`).update({
      [`reactionCounts.${type}`]: FieldValue.increment(-1),
      [`reactionCounts.total`]: FieldValue.increment(-1),
      likes: FieldValue.increment(-1),
      likedBy: FieldValue.arrayRemove(e.params.userId),
    }).catch((err) => console.warn('onPostReactionDelete:', err?.message ?? err))
  },
)
