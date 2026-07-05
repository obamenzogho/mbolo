import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import * as crypto from 'crypto'

const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET')
const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY')

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

/* ---------- CLOUDINARY SIGNATURE : callable ---------- */
export const signCloudinaryUpload = onCall(
  { secrets: [CLOUDINARY_API_SECRET, CLOUDINARY_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in')
    }

    const uid = request.auth.uid
    const resourceType = request.data?.resourceType === 'video' ? 'video' : 'image'
    const folder = resourceType === 'video' ? `reels/${uid}` : `profile/${uid}`

    const timestamp = Math.floor(Date.now() / 1000)
    const apiSecret = CLOUDINARY_API_SECRET.value()
    const apiKey = CLOUDINARY_API_KEY.value()

    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`
    const signature = crypto.createHash('sha256').update(toSign).digest('hex')

    return { signature, timestamp, folder, apiKey }
  },
)

/* ---------- PUSH NOTIFICATIONS : on notification doc created ---------- */
const PUSH_MESSAGES: Record<string, (name: string) => { title: string; body: string }> = {
  follow: (n) => ({ title: '👤 Nouvel abonné', body: `${n} s'est abonné à toi` }),
  follow_request: (n) => ({ title: '📩 Demande', body: `${n} veut te suivre` }),
  follow_accept: (n) => ({ title: '✅ Demande acceptée', body: `${n} a accepté ta demande` }),
  like: (n) => ({ title: '❤️ Like', body: `${n} a aimé ta vidéo` }),
  comment: (n) => ({ title: '💬 Commentaire', body: `${n} a commenté ta vidéo` }),
  reply: (n) => ({ title: '↩️ Réponse', body: `${n} a répondu à ton commentaire` }),
  repost: (n) => ({ title: '🔄 Republication', body: `${n} a republié ta vidéo` }),
  mention: (n) => ({ title: '🏷️ Mention', body: `${n} t'a mentionné` }),
}

export const onNotificationCreate = onDocumentCreated('notifications/{notifId}', async (event) => {
  const notif = event.data?.data()
  if (!notif) return

  const { userId, fromUserId, type } = notif
  if (!userId || userId === fromUserId) return

  const [targetSnap, fromSnap] = await Promise.all([
    db.doc(`users/${userId}`).get(),
    fromUserId ? db.doc(`users/${fromUserId}`).get() : Promise.resolve(null),
  ])

  const target = targetSnap.data()
  const pushToken: string | undefined = target?.pushToken
  if (!pushToken || target?.notifications === false) return

  const fromName = fromSnap?.data()?.pseudo || 'Quelqu\'un'
  const builder = PUSH_MESSAGES[type]
  if (!builder) return
  const { title, body } = builder(fromName)

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: pushToken,
      title,
      body,
      sound: 'default',
      data: { type, fromUserId, ...notif.data },
    }),
  }).catch((e) => console.warn('push send failed:', e?.message ?? e))
})

/* ---------- HASHTAGS : trending counters + decay ---------- */
const TRENDING_HALFLIFE_DAYS = 3

export const onVideoCreateHashtags = onDocumentCreated('videos/{videoId}', async (event) => {
  const video = event.data?.data()
  const tags: string[] = video?.hashtags ?? []
  if (!tags.length) return

  const now = Date.now()
  const batch = db.batch()
  for (const tag of tags) {
    const ref = db.doc(`hashtags/${tag}`)
    batch.set(ref, {
      tag,
      videoCount: FieldValue.increment(1),
      trendingScore: FieldValue.increment(1),
      lastUsedAt: now,
    }, { merge: true })
  }
  await batch.commit().catch((e) => console.warn('hashtag create failed:', e?.message ?? e))
})

export const onVideoDeleteHashtags = onDocumentDeleted('videos/{videoId}', async (event) => {
  const video = event.data?.data()
  const tags: string[] = video?.hashtags ?? []
  if (!tags.length) return

  const batch = db.batch()
  for (const tag of tags) {
    batch.set(db.doc(`hashtags/${tag}`), {
      videoCount: FieldValue.increment(-1),
    }, { merge: true })
  }
  await batch.commit().catch((e) => console.warn('hashtag delete failed:', e?.message ?? e))
})

export const decayTrendingScores = onSchedule('every 24 hours', async () => {
  const decay = Math.pow(0.5, 1 / TRENDING_HALFLIFE_DAYS)
  const snap = await db.collection('hashtags').where('trendingScore', '>', 0.1).get()

  const batch = db.batch()
  snap.docs.forEach((d) => {
    const score = (d.data().trendingScore ?? 0) * decay
    batch.update(d.ref, { trendingScore: score < 0.1 ? 0 : score })
  })
  await batch.commit().catch((e) => console.warn('decay failed:', e?.message ?? e))
})
