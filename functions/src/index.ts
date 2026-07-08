import { onDocumentCreated, onDocumentDeleted, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
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
export const onLikeCreate = onDocumentCreated('videos/{videoId}/likes/{userId}', async (e) => {
  const videoRef = db.doc(`videos/${e.params.videoId}`)
  await videoRef.update({
    likes: FieldValue.increment(1),
    likedBy: FieldValue.arrayUnion(e.params.userId),   // ✅ serveur possède le tableau
  }).catch((err) => console.warn('onLikeCreate:', err?.message ?? err))
  const creatorId = (await videoRef.get()).data()?.userId
  if (creatorId) await db.doc(`users/${creatorId}`).update({ totalLikes: FieldValue.increment(1) })
})

export const onLikeDelete = onDocumentDeleted('videos/{videoId}/likes/{userId}', async (e) => {
  const videoRef = db.doc(`videos/${e.params.videoId}`)
  await videoRef.update({
    likes: FieldValue.increment(-1),
    likedBy: FieldValue.arrayRemove(e.params.userId),
  }).catch((err) => console.warn('onLikeDelete:', err?.message ?? err))
  const creatorId = (await videoRef.get()).data()?.userId
  if (creatorId) await db.doc(`users/${creatorId}`).update({ totalLikes: FieldValue.increment(-1) })
})

/* ---------- SAVES : videos/{videoId}/saves/{userId} ---------- */
export const onSaveCreate = onDocumentCreated('videos/{videoId}/saves/{userId}', (e) =>
  db.doc(`videos/${e.params.videoId}`).update({
    saves: FieldValue.increment(1),
    savedBy: FieldValue.arrayUnion(e.params.userId),
  }).catch((err) => console.warn('onSaveCreate:', err?.message ?? err)),
)
export const onSaveDelete = onDocumentDeleted('videos/{videoId}/saves/{userId}', (e) =>
  db.doc(`videos/${e.params.videoId}`).update({
    saves: FieldValue.increment(-1),
    savedBy: FieldValue.arrayRemove(e.params.userId),
  }).catch((err) => console.warn('onSaveDelete:', err?.message ?? err)),
)

/* ---------- COMMENTS ---------- */
export const onCommentCreate = onDocumentCreated('videos/{videoId}/comments/{commentId}', async (e) => {
  const c = e.data?.data(); if (!c) return
  const videoRef = db.doc(`videos/${e.params.videoId}`)
  const preview = {
    id: e.params.commentId,
    text: c.text ?? '',
    authorName: c.authorName ?? 'Utilisateur',
    authorPhoto: c.authorPhoto ?? null,
    likes: 0,
  }
  await db.runTransaction(async (tx) => {
    const prev = (await tx.get(videoRef)).data()?.previewComments ?? []
    tx.update(videoRef, {
      comments: FieldValue.increment(1),
      previewComments: [preview, ...prev].slice(0, 3),
    })
  }).catch((err) => console.warn('onCommentCreate:', err?.message ?? err))
})

export const onCommentDelete = onDocumentDeleted('videos/{videoId}/comments/{commentId}', (e) => {
  const replyCount = e.data?.get('replyCount') ?? 0   // ✅ décompte le commentaire + ses réponses
  return db.doc(`videos/${e.params.videoId}`)
    .update({ comments: FieldValue.increment(-1 - replyCount) })
    .catch((err) => console.warn('onCommentDelete:', err?.message ?? err))
})

/* ---------- COMMENTS → CREATOR totalComments ---------- */
export const onCommentUpdateCreatorTotal = onDocumentCreated('videos/{videoId}/comments/{commentId}', async (event) => {
  const videoSnap = await db.doc(`videos/${event.params.videoId}`).get()
  const creatorId = videoSnap.data()?.userId
  if (creatorId) await db.doc(`users/${creatorId}`).update({ totalComments: FieldValue.increment(1) }).catch(() => {})
})
export const onCommentDeleteCreatorTotal = onDocumentDeleted('videos/{videoId}/comments/{commentId}', async (event) => {
  const videoSnap = await db.doc(`videos/${event.params.videoId}`).get()
  const creatorId = videoSnap.data()?.userId
  if (creatorId) await db.doc(`users/${creatorId}`).update({ totalComments: FieldValue.increment(-1) }).catch(() => {})
})

/* ---------- REPLIES : videos/{v}/comments/{c}/replies/{r} ---------- */
export const onReplyCreate = onDocumentCreated('videos/{videoId}/comments/{commentId}/replies/{replyId}', (e) =>
  Promise.all([
    db.doc(`videos/${e.params.videoId}/comments/${e.params.commentId}`).update({ replyCount: FieldValue.increment(1) }),
    db.doc(`videos/${e.params.videoId}`).update({ comments: FieldValue.increment(1) }),
  ]).catch((err) => console.warn('onReplyCreate:', err?.message ?? err)),
)
export const onReplyDelete = onDocumentDeleted('videos/{videoId}/comments/{commentId}/replies/{replyId}', (e) =>
  Promise.all([
    db.doc(`videos/${e.params.videoId}/comments/${e.params.commentId}`).update({ replyCount: FieldValue.increment(-1) }),
    db.doc(`videos/${e.params.videoId}`).update({ comments: FieldValue.increment(-1) }),
  ]).catch((err) => console.warn('onReplyDelete:', err?.message ?? err)),
)

/* ---------- VIEWS : videos/{videoId}/views/{userId} (une par user) ---------- */
export const onViewCreate = onDocumentCreated('videos/{videoId}/views/{userId}', (e) =>
  bump(`videos/${e.params.videoId}`, 'views', 1),
)

/* ---------- VIEWS → CREATOR totalViews ---------- */
export const onViewUpdateCreatorTotal = onDocumentCreated('videos/{videoId}/views/{userId}', async (event) => {
  const videoSnap = await db.doc(`videos/${event.params.videoId}`).get()
  const creatorId = videoSnap.data()?.userId
  if (creatorId) await db.doc(`users/${creatorId}`).update({ totalViews: FieldValue.increment(1) }).catch(() => {})
})

/* ---------- REPOSTS ---------- */
export const onRepostCreate = onDocumentCreated('reposts/{repostId}', async (e) => {
  const { userId, postId } = e.data?.data() ?? {}
  if (!userId || !postId) return
  const userName = (await db.doc(`users/${userId}`).get()).data()?.pseudo ?? userId
  await db.doc(`videos/${postId}`).update({
    reposts: FieldValue.increment(1),
    repostedBy: FieldValue.arrayUnion(userId),
    latestRepostedBy: { userId, userName },
  }).catch((err) => console.warn('onRepostCreate:', err?.message ?? err))
})

export const onRepostDelete = onDocumentDeleted('reposts/{repostId}', async (e) => {
  const { userId, postId } = e.data?.data() ?? {}
  if (!userId || !postId) return
  const videoRef = db.doc(`videos/${postId}`)
  await db.runTransaction(async (tx) => {
    const remaining = ((await tx.get(videoRef)).data()?.repostedBy ?? []).filter((id: string) => id !== userId)
    const update: Record<string, any> = {
      reposts: FieldValue.increment(-1),
      repostedBy: FieldValue.arrayRemove(userId),
    }
    if (remaining.length > 0) {
      const last = remaining[remaining.length - 1]
      const lastName = (await db.doc(`users/${last}`).get()).data()?.pseudo ?? last
      update.latestRepostedBy = { userId: last, userName: lastName }
    } else {
      update.latestRepostedBy = FieldValue.delete()
    }
    tx.update(videoRef, update)
  }).catch((err) => console.warn('onRepostDelete:', err?.message ?? err))
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

/* ---------- SHARES → CREATOR totalShares ---------- */
export const onShareUpdateCreatorTotal = onDocumentCreated('shares/{shareId}', async (event) => {
  const videoId = event.data?.get('postId')
  if (!videoId) return
  const videoSnap = await db.doc(`videos/${videoId}`).get()
  const creatorId = videoSnap.data()?.userId
  if (creatorId) await db.doc(`users/${creatorId}`).update({ totalShares: FieldValue.increment(1) }).catch(() => {})
})
export const onUnshareUpdateCreatorTotal = onDocumentDeleted('shares/{shareId}', async (event) => {
  const videoId = event.data?.get('postId')
  if (!videoId) return
  const videoSnap = await db.doc(`videos/${videoId}`).get()
  const creatorId = videoSnap.data()?.userId
  if (creatorId) await db.doc(`users/${creatorId}`).update({ totalShares: FieldValue.increment(-1) }).catch(() => {})
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
    // SHA-1 est l'algo par défaut de Cloudinary. Si ton compte est passé en SHA-256
    // (Settings > Security > Signature algorithm), remplace 'sha1' par 'sha256'.
    const signature = crypto.createHash('sha1').update(toSign).digest('hex')

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
  tag: (n) => ({ title: '🏷️ Identification', body: `${n} t'a identifié dans une vidéo` }),
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

/* ---------- TAGS : notifs when users are tagged in a video ---------- */
export const onVideoTagPeople = onDocumentCreated('videos/{videoId}', async (event) => {
  const video = event.data?.data()
  const tagged: string[] = video?.taggedUsers ?? []
  if (!tagged.length || !video) return

  const batch = db.batch()
  for (const uid of tagged) {
    if (uid === video.userId) continue
    const ref = db.collection('notifications').doc()
    batch.set(ref, {
      userId: uid,
      fromUserId: video.userId,
      type: 'tag',
      videoId: event.params.videoId,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    })
  }
  await batch.commit().catch((e) => console.warn('tag notif failed:', e?.message ?? e))
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

/* ---------- MODERATION : auto-action on reports ---------- */
const AUTO_HIDE_THRESHOLD = 5
const CRITICAL_REASONS = ['nudity', 'violence', 'self_harm', 'hate']

export const onReportCreate = onDocumentCreated('reports/{reportId}', async (event) => {
  const report = event.data?.data()
  if (!report) return

  const { targetType, targetId, contentOwnerId, reason } = report
  if (!targetId || !targetType) return

  const reportsSnap = await db.collection('reports')
    .where('targetId', '==', targetId)
    .where('targetType', '==', targetType)
    .get()

  const uniqueReporters = new Set<string>()
  const reasons: string[] = []
  reportsSnap.docs.forEach((d) => {
    const r = d.data()
    if (r.reportedBy) uniqueReporters.add(r.reportedBy)
    if (r.reason) reasons.push(r.reason)
  })
  const reportCount = uniqueReporters.size
  const criticalCount = reasons.filter((r) => CRITICAL_REASONS.includes(r)).length

  const shouldAutoHide =
    reportCount >= AUTO_HIDE_THRESHOLD ||
    (CRITICAL_REASONS.includes(reason) && criticalCount >= 2)

  if (!shouldAutoHide) return

  try {
    if (targetType === 'video') {
      await db.doc(`videos/${targetId}`).update({
        moderationStatus: 'hidden',
        hiddenAt: FieldValue.serverTimestamp(),
        hiddenReason: 'auto_report_threshold',
      })
    } else if (targetType === 'comment') {
      if (report.commentPath) {
        await db.doc(report.commentPath).update({ moderationStatus: 'hidden' })
      }
    } else if (targetType === 'story') {
      await db.doc(`stories/${targetId}`).update({ moderationStatus: 'hidden' })
    } else if (targetType === 'user' && contentOwnerId) {
      await db.doc(`users/${contentOwnerId}`).update({
        moderationFlag: true,
        moderationFlaggedAt: FieldValue.serverTimestamp(),
      })
    }

    const batch = db.batch()
    reportsSnap.docs.forEach((d) => batch.update(d.ref, { status: 'actioned' }))
    await batch.commit()
  } catch (e) {
    console.warn('auto-moderation failed:', (e as any)?.message ?? e)
  }
})

/* ---------- TYPESENSE SEARCH SYNC ---------- */
export * from './search'

/* ---------- DELETE ACCOUNT : callable ---------- */
export const deleteAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in')
  const uid = request.auth.uid

  const userSnap = await db.doc(`users/${uid}`).get()
  const pseudo = userSnap.data()?.pseudo
  if (pseudo) await db.doc(`usernames/${pseudo}`).delete().catch(() => {})

  const videos = await db.collection('videos').where('userId', '==', uid).get()
  for (const v of videos.docs) await db.recursiveDelete(v.ref)

  for (const col of ['stories', 'reposts', 'shares', 'highlights']) {
    const snap = await db.collection(col).where('userId', '==', uid).get()
    const batch = db.batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit().catch(() => {})
  }
  const notifs = await db.collection('notifications').where('userId', '==', uid).get()
  const nb = db.batch()
  notifs.docs.forEach((d) => nb.delete(d.ref))
  await nb.commit().catch(() => {})

  await db.recursiveDelete(userSnap.ref)
  await getAuth().deleteUser(uid)

  return { ok: true }
})

/* ==========================================================
   HOT SCORE — ranking global (engagement + fraîcheur)
   La partie perso (affinité, watch ratio) reste côté client.
   ========================================================== */
const HOT_FRESHNESS_TAU = 36        // heures, identique au client
const HOT_DECAY_WINDOW_DAYS = 14    // au-delà, on ne rafraîchit plus la fraîcheur

function computeHotScore(data: FirebaseFirestore.DocumentData, now = Date.now()): number {
  const engagement =
    Math.log1p(data.likes ?? 0) * 1.0 +
    Math.log1p(data.comments ?? 0) * 1.5 +
    Math.log1p(data.shares ?? 0) * 2.0 +
    Math.log1p(data.saves ?? 0) * 1.8

  const createdMs = data.createdAt?.toMillis?.() ?? now
  const ageHours = Math.max(0, (now - createdMs) / 3_600_000)
  const freshness = Math.exp(-ageHours / HOT_FRESHNESS_TAU)

  // Même pondération que scoreVideo côté client (partie globale)
  return Number((engagement * 1.0 + freshness * 4.0).toFixed(4))
}

/* --- Événementiel : recalcule quand un compteur change --- */
export const onVideoWriteHotScore = onDocumentWritten('videos/{videoId}', async (event) => {
  const after = event.data?.after
  if (!after?.exists) return                     // vidéo supprimée
  const before = event.data?.before?.data()
  const data = after.data()!

  // ✅ Anti-boucle : si SEULS hotScore/hotScoreUpdatedAt ont changé, on stoppe
  const engagementChanged = !before ||
    before.likes !== data.likes ||
    before.comments !== data.comments ||
    before.shares !== data.shares ||
    before.saves !== data.saves ||
    before.createdAt?.toMillis?.() !== data.createdAt?.toMillis?.()
  if (!engagementChanged) return

  const hotScore = computeHotScore(data)
  if (data.hotScore === hotScore) return         // rien à écrire

  await after.ref.update({
    hotScore,
    hotScoreUpdatedAt: FieldValue.serverTimestamp(),
  }).catch((e) => console.warn('onVideoWriteHotScore:', e?.message ?? e))
})

/* --- Planifié : rafraîchit la fraîcheur des vidéos récentes --- */
export const refreshHotScores = onSchedule('every 60 minutes', async () => {
  const cutoff = new Date(Date.now() - HOT_DECAY_WINDOW_DAYS * 86_400_000)
  const snap = await db.collection('videos')
    .where('createdAt', '>=', cutoff)
    .get()

  const now = Date.now()
  let batch = db.batch()
  let ops = 0
  for (const d of snap.docs) {
    const hotScore = computeHotScore(d.data(), now)
    if (d.data().hotScore === hotScore) continue
    batch.update(d.ref, { hotScore })
    if (++ops === 450) { await batch.commit(); batch = db.batch(); ops = 0 }  // limite 500/batch
  }
  if (ops > 0) await batch.commit()
})
