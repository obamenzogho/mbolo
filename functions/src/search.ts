import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import Typesense from 'typesense'
import { USERS_SCHEMA, HASHTAGS_SCHEMA, POSTS_SCHEMA } from '../../src/lib/typesense-schemas'

const TYPESENSE_HOST = defineSecret('TYPESENSE_HOST')
const TYPESENSE_ADMIN_KEY = defineSecret('TYPESENSE_ADMIN_KEY')

const SECRETS = [TYPESENSE_HOST, TYPESENSE_ADMIN_KEY]

function client() {
  return new Typesense.Client({
    nodes: [{ host: TYPESENSE_HOST.value(), port: 443, protocol: 'https' }],
    apiKey: TYPESENSE_ADMIN_KEY.value(),
    connectionTimeoutSeconds: 5,
  })
}

type PostMediaType = 'text' | 'image' | 'carousel' | 'article' | 'video' | 'video_share'

function toMs(ts: Timestamp | { seconds: number; nanoseconds: number } | number | undefined | null): number {
  if (!ts) return 0
  if (typeof ts === 'number') return ts
  if ('toMillis' in ts && typeof (ts as Timestamp).toMillis === 'function') return (ts as Timestamp).toMillis()
  if ('seconds' in ts) return (ts as { seconds: number }).seconds * 1000
  return 0
}

function computeRecencyScore(likeCount: number, createdAtMs: number): number {
  if (!createdAtMs) return likeCount
  const ageDays = (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)
  return likeCount * Math.exp(-Math.max(ageDays, 0) / 30)
}

function mapPost(d: FirebaseFirestore.DocumentData, id: string) {
  const likeCount = (d.likes ?? d.likeCount ?? 0) as number
  const commentCount = (d.commentCount ?? d.comments ?? 0) as number
  const viewCount = (d.viewCount ?? d.views ?? 0) as number
  const media = Array.isArray(d.media) ? d.media : []
  const firstMedia = media[0] as { url?: string; thumbnailUrl?: string; type?: string } | undefined
  const mediaUrl = (d.mediaUrl ?? firstMedia?.url ?? '') as string
  const thumbnailUrl = (d.thumbnailUrl ?? d.thumbnailURL ?? firstMedia?.thumbnailUrl ?? mediaUrl) as string
  const mediaType = (d.mediaType ?? (firstMedia?.type ?? (media.length > 1 ? 'carousel' : (firstMedia ? 'image' : 'text')))) as PostMediaType
  const createdAtMs = toMs(d.createdAt as Timestamp)
  return {
    id,
    text: (d.text ?? d.description ?? '') as string,
    userName: (d.userName ?? '') as string,
    userId: (d.userId ?? '') as string,
    userPhoto: (d.userPhoto ?? d.authorPhoto ?? '') as string,
    likeCount,
    commentCount,
    viewCount,
    mediaType,
    mediaUrl,
    thumbnailUrl,
    createdAt: createdAtMs,
    visibility: (d.visibility ?? 'public') as string,
    moderationStatus: (d.moderationStatus ?? 'approved') as string,
    recencyScore: computeRecencyScore(likeCount, createdAtMs),
  }
}

// ─── Sync users → Typesense ───
export const syncUserToSearch = onDocumentWritten(
  { document: 'users/{uid}', secrets: SECRETS },
  async (event) => {
    const uid = event.params.uid
    const after = event.data?.after.data()
    const ts = client()
    if (!after) {
      await ts.collections('users').documents(uid).delete().catch(() => {})
      return
    }
    await ts.collections('users').documents().upsert({
      id: uid,
      pseudo: after.pseudo ?? '',
      nom: after.nom ?? '',
      photoURL: after.photoURL ?? '',
      verified: !!after.verified,
      followerCount: after.followerCount ?? 0,
    }).catch((e) => console.warn('syncUser failed:', e?.message ?? e))
  },
)

// ─── Sync hashtags → Typesense ───
export const syncHashtagToSearch = onDocumentWritten(
  { document: 'hashtags/{tag}', secrets: SECRETS },
  async (event) => {
    const tag = event.params.tag
    const after = event.data?.after.data()
    const ts = client()
    if (!after || (after.videoCount ?? 0) <= 0) {
      await ts.collections('hashtags').documents(tag).delete().catch(() => {})
      return
    }
    await ts.collections('hashtags').documents().upsert({
      id: tag,
      tag,
      videoCount: after.videoCount ?? 0,
      trendingScore: after.trendingScore ?? 0,
    }).catch((e) => console.warn('syncHashtag failed:', e?.message ?? e))
  },
)

// ─── Sync posts → Typesense ───
export const syncPostToSearch = onDocumentWritten(
  { document: 'posts/{postId}', secrets: SECRETS },
  async (event) => {
    const postId = event.params.postId
    const after = event.data?.after.data()
    const ts = client()
    if (!after) {
      await ts.collections('posts').documents(postId).delete().catch(() => {})
      return
    }
    await ts.collections('posts').documents().upsert(mapPost(after, postId)).catch((e) =>
      console.warn('syncPost failed:', e?.message ?? e),
    )
  },
)

// ─── Init schéma (callable, une fois) ───
export const initSearchSchema = onCall({ secrets: SECRETS }, async (req) => {
  if (!req.auth?.token?.admin) throw new HttpsError('permission-denied', 'Admin only')
  const ts = client()
  for (const schema of [USERS_SCHEMA, HASHTAGS_SCHEMA, POSTS_SCHEMA]) {
    await ts.collections(schema.name).delete().catch(() => {})
    await ts.collections().create(schema as any)
  }
  return { ok: true, created: ['users', 'hashtags', 'posts'] }
})

// ─── Backfill (callable, admin-only) ───
export const backfillSearch = onCall({ secrets: SECRETS, timeoutSeconds: 540 }, async (req) => {
  if (!req.auth?.token?.admin) throw new HttpsError('permission-denied', 'Admin only')
  const db = getFirestore()
  const ts = client()

  const usersSnap = await db.collection('users').get()
  const userDocs = usersSnap.docs.map((d) => {
    const u = d.data()
    return {
      id: d.id, pseudo: u.pseudo ?? '', nom: u.nom ?? '',
      photoURL: u.photoURL ?? '', verified: !!u.verified,
      followerCount: u.followerCount ?? 0,
    }
  })

  const tagsSnap = await db.collection('hashtags').get()
  const tagDocs = tagsSnap.docs
    .map((d) => ({ id: d.id, tag: d.data().tag ?? d.id, videoCount: d.data().videoCount ?? 0, trendingScore: d.data().trendingScore ?? 0 }))
    .filter((h) => h.videoCount > 0)

  const postsSnap = await db.collection('posts').where('visibility', '==', 'public').orderBy('createdAt', 'desc').limit(1000).get()
  const postDocs = postsSnap.docs.map((d) => mapPost(d.data(), d.id))

  if (userDocs.length) await ts.collections('users').documents().import(userDocs, { action: 'upsert' })
  if (tagDocs.length) await ts.collections('hashtags').documents().import(tagDocs, { action: 'upsert' })
  if (postDocs.length) await ts.collections('posts').documents().import(postDocs, { action: 'upsert' })

  return { ok: true, users: userDocs.length, hashtags: tagDocs.length, posts: postDocs.length }
})
