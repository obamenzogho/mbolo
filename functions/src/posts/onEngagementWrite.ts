import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

/* ─────────────────────────────────────────────────────────────
   ENGAGEMENT SUR LES POSTS — agrégats possédés par le backend

   Le mobile écrit son intention dans des sous-collections par utilisateur :
     posts/{postId}/saves/{userId}
     posts/{postId}/reposts/{userId}
     posts/{postId}/shares/{userId}
     posts/{postId}/comments/{commentId}
     posts/{postId}/pollVotes/{userId}
   Ce module maintient les compteurs du document post à partir de ces
   intentions. firestore.rules interdit au mobile d'écrire ces champs.
   ───────────────────────────────────────────────────────────── */

async function bumpPost(
  postId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  await getFirestore()
    .doc(`posts/${postId}`)
    .update(updates)
    .catch((err) => console.warn('post aggregate:', err?.message ?? err))
}

/* ---------- SAVES ---------- */
export const onPostSaveCreate = onDocumentCreated(
  'posts/{postId}/saves/{userId}',
  (e) => bumpPost(e.params.postId, {
    saves: FieldValue.increment(1),
    savedBy: FieldValue.arrayUnion(e.params.userId),
  }),
)

export const onPostSaveDelete = onDocumentDeleted(
  'posts/{postId}/saves/{userId}',
  (e) => bumpPost(e.params.postId, {
    saves: FieldValue.increment(-1),
    savedBy: FieldValue.arrayRemove(e.params.userId),
  }),
)

/* ---------- REPOSTS ---------- */
export const onPostRepostCreate = onDocumentCreated(
  'posts/{postId}/reposts/{userId}',
  (e) => bumpPost(e.params.postId, {
    reposts: FieldValue.increment(1),
    repostedBy: FieldValue.arrayUnion(e.params.userId),
  }),
)

export const onPostRepostDelete = onDocumentDeleted(
  'posts/{postId}/reposts/{userId}',
  (e) => bumpPost(e.params.postId, {
    reposts: FieldValue.increment(-1),
    repostedBy: FieldValue.arrayRemove(e.params.userId),
  }),
)

/* ---------- SHARES ---------- */
export const onPostShareCreate = onDocumentCreated(
  'posts/{postId}/shares/{userId}',
  (e) => bumpPost(e.params.postId, { shares: FieldValue.increment(1) }),
)

export const onPostShareDelete = onDocumentDeleted(
  'posts/{postId}/shares/{userId}',
  (e) => bumpPost(e.params.postId, { shares: FieldValue.increment(-1) }),
)

/* ---------- COMMENTS ---------- */
export const onPostCommentCreate = onDocumentCreated(
  'posts/{postId}/comments/{commentId}',
  (e) => bumpPost(e.params.postId, { comments: FieldValue.increment(1) }),
)

export const onPostCommentDelete = onDocumentDeleted(
  'posts/{postId}/comments/{commentId}',
  (e) => bumpPost(e.params.postId, { comments: FieldValue.increment(-1) }),
)

/* ---------- POLL VOTES ---------- */
/* Recalcule `poll.options` (votes + votedBy) depuis la sous-collection
   pollVotes — un document par utilisateur, `optionId` = option votée.
   Les votes orphelins (option retirée à l'édition) sont ignorés. */
export const onPostPollVoteWrite = onDocumentWritten(
  'posts/{postId}/pollVotes/{userId}',
  async (e) => {
    const db = getFirestore()
    const postId = e.params.postId
    const postRef = db.doc(`posts/${postId}`)

    const [postSnap, votesSnap] = await Promise.all([
      postRef.get().catch(() => null),
      db.collection(`posts/${postId}/pollVotes`).get().catch(() => null),
    ])

    const post = postSnap?.data()
    const currentOptions = post?.poll?.options
    if (!post || !Array.isArray(currentOptions) || !votesSnap) return

    const byOption = new Map<string, string[]>()
    for (const doc of votesSnap.docs) {
      const optionId = doc.data()?.optionId as string | undefined
      if (!optionId) continue

      const list = byOption.get(optionId) ?? []
      list.push(doc.id)
      byOption.set(optionId, list)
    }

    const options = currentOptions.map((option: { id: string }) => {
      const votedBy = byOption.get(option.id) ?? []
      return { ...option, votes: votedBy.length, votedBy }
    })

    await postRef
      .update({ poll: { ...post.poll, options } })
      .catch((err) => console.warn('onPostPollVoteWrite:', err?.message ?? err))
  },
)
