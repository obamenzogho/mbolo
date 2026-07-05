import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

initializeApp()
const db = getFirestore()

const bump = (path: string, field: string, delta: number) =>
  db.doc(path).update({ [field]: FieldValue.increment(delta) }).catch((e) => {
    console.warn(`bump ${field} ${delta} on ${path} failed:`, e?.message ?? e)
  })

/* ---------- LIKES : videos/{videoId}/likes/{userId} ---------- */
export const onLikeCreate = onDocumentCreated('videos/{videoId}/likes/{userId}', (e) =>
  bump(`videos/${e.params.videoId}`, 'likes', 1),
)
export const onLikeDelete = onDocumentDeleted('videos/{videoId}/likes/{userId}', (e) =>
  bump(`videos/${e.params.videoId}`, 'likes', -1),
)

/* ---------- SAVES : videos/{videoId}/saves/{userId} ---------- */
export const onSaveCreate = onDocumentCreated('videos/{videoId}/saves/{userId}', (e) =>
  bump(`videos/${e.params.videoId}`, 'saves', 1),
)
export const onSaveDelete = onDocumentDeleted('videos/{videoId}/saves/{userId}', (e) =>
  bump(`videos/${e.params.videoId}`, 'saves', -1),
)

/* ---------- COMMENTS : videos/{videoId}/comments/{commentId} ---------- */
export const onCommentCreate = onDocumentCreated('videos/{videoId}/comments/{commentId}', (e) =>
  bump(`videos/${e.params.videoId}`, 'comments', 1),
)
export const onCommentDelete = onDocumentDeleted('videos/{videoId}/comments/{commentId}', (e) =>
  bump(`videos/${e.params.videoId}`, 'comments', -1),
)

/* ---------- VIEWS : videos/{videoId}/views/{userId} (une par user) ---------- */
export const onViewCreate = onDocumentCreated('videos/{videoId}/views/{userId}', (e) =>
  bump(`videos/${e.params.videoId}`, 'views', 1),
)

/* ---------- REPOSTS : collection top-level reposts, champ postId ---------- */
export const onRepostCreate = onDocumentCreated('reposts/{repostId}', (e) => {
  const videoId = e.data?.get('postId')
  return videoId ? bump(`videos/${videoId}`, 'reposts', 1) : null
})
export const onRepostDelete = onDocumentDeleted('reposts/{repostId}', (e) => {
  const videoId = e.data?.get('postId')
  return videoId ? bump(`videos/${videoId}`, 'reposts', -1) : null
})

/* ---------- SHARES : collection top-level shares, champ postId ---------- */
export const onShareCreate = onDocumentCreated('shares/{shareId}', (e) => {
  const videoId = e.data?.get('postId')
  return videoId ? bump(`videos/${videoId}`, 'shares', 1) : null
})
export const onShareDelete = onDocumentDeleted('shares/{shareId}', (e) => {
  const videoId = e.data?.get('postId')
  return videoId ? bump(`videos/${videoId}`, 'shares', -1) : null
})
