import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getFirestore } from 'firebase-admin/firestore'
import Typesense from 'typesense'

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

const USERS_SCHEMA = {
  name: 'users',
  fields: [
    { name: 'pseudo', type: 'string' as const },
    { name: 'nom', type: 'string' as const, optional: true },
    { name: 'photoURL', type: 'string' as const, optional: true },
    { name: 'verified', type: 'bool' as const },
    { name: 'followerCount', type: 'int32' as const },
  ],
  default_sorting_field: 'followerCount',
}

const HASHTAGS_SCHEMA = {
  name: 'hashtags',
  fields: [
    { name: 'tag', type: 'string' as const },
    { name: 'videoCount', type: 'int32' as const },
    { name: 'trendingScore', type: 'float' as const },
  ],
  default_sorting_field: 'videoCount',
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

// ─── Init schéma (callable, une fois) ───
export const initSearchSchema = onCall({ secrets: SECRETS }, async (req) => {
  if (!req.auth?.token?.admin) throw new HttpsError('permission-denied', 'Admin only')
  const ts = client()
  for (const schema of [USERS_SCHEMA, HASHTAGS_SCHEMA]) {
    await ts.collections(schema.name).delete().catch(() => {})
    await ts.collections().create(schema as any)
  }
  return { ok: true, created: ['users', 'hashtags'] }
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

  if (userDocs.length) await ts.collections('users').documents().import(userDocs, { action: 'upsert' })
  if (tagDocs.length) await ts.collections('hashtags').documents().import(tagDocs, { action: 'upsert' })

  return { ok: true, users: userDocs.length, hashtags: tagDocs.length }
})
