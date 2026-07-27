#!/usr/bin/env node
/**
 * typesense-sync.mjs — Script local de sync Firestore → Typesense Cloud.
 * Remplace les cloud functions tant que Blaze n'est pas actif.
 *
 * Usage :
 *   node scripts/typesense-sync.mjs
 *
 * Environnement requis (dans .env) :
 *   TYPESENSE_ADMIN_KEY=<clé admin Typesense>
 *
 * Le script lit aussi EXPO_PUBLIC_TYPESENSE_HOST depuis .env.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import Typesense from 'typesense'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Load .env manually (no dotenv dependency) ─────────────
const envPath = resolve(__dirname, '..', '.env')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  if (!process.env[key]) process.env[key] = val
}

// ─── Config ─────────────────────────────────────────────────
const TYPESENSE_HOST = process.env.EXPO_PUBLIC_TYPESENSE_HOST
const TYPESENSE_ADMIN_KEY = process.env.TYPESENSE_ADMIN_KEY

if (!TYPESENSE_HOST || !TYPESENSE_ADMIN_KEY) {
  console.error('❌ Missing EXPO_PUBLIC_TYPESENSE_HOST or TYPESENSE_ADMIN_KEY in .env')
  process.exit(1)
}

// ─── Firebase Admin ─────────────────────────────────────────
const serviceAccount = JSON.parse(readFileSync(resolve(__dirname, '..', 'serviceAccountKey.json'), 'utf8'))
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

// ─── Typesense Client ──────────────────────────────────────
const ts = new Typesense.Client({
  nodes: [{ host: TYPESENSE_HOST, port: 443, protocol: 'https' }],
  apiKey: TYPESENSE_ADMIN_KEY,
  connectionTimeoutSeconds: 5,
})

// ─── Schemas ────────────────────────────────────────────────
// ⚠️ Ces définitions DOIVENT rester identiques à src/lib/typesense-schemas.ts.
// Le script .mjs ne peut pas importer le .ts (Node sans transpile), donc on
// duplique ici en gardant les deux fichiers synchronisés manuellement.

const USERS_SCHEMA = {
  name: 'users',
  fields: [
    { name: 'pseudo', type: 'string' },
    { name: 'nom', type: 'string', optional: true },
    { name: 'bio', type: 'string', optional: true },
    { name: 'city', type: 'string', optional: true },
    { name: 'interests', type: 'string[]', optional: true },
    { name: 'photoURL', type: 'string', optional: true },
    { name: 'verified', type: 'bool' },
    { name: 'followerCount', type: 'int32' },
  ],
  default_sorting_field: 'followerCount',
}

const HASHTAGS_SCHEMA = {
  name: 'hashtags',
  fields: [
    { name: 'tag', type: 'string' },
    { name: 'videoCount', type: 'int32' },
    { name: 'trendingScore', type: 'float' },
  ],
  default_sorting_field: 'videoCount',
}

const POSTS_SCHEMA = {
  name: 'posts',
  fields: [
    { name: 'text', type: 'string' },
    { name: 'userName', type: 'string' },
    { name: 'userId', type: 'string' },
    { name: 'userPhoto', type: 'string', optional: true },
    { name: 'likeCount', type: 'int32' },
    { name: 'commentCount', type: 'int32' },
    { name: 'createdAt', type: 'int64' },
    { name: 'visibility', type: 'string', optional: true },
    { name: 'moderationStatus', type: 'string', optional: true },
    { name: 'mediaType', type: 'string', optional: true },
    { name: 'mediaUrl', type: 'string', optional: true },
    { name: 'thumbnailUrl', type: 'string', optional: true },
    { name: 'recencyScore', type: 'float', optional: true },
  ],
  default_sorting_field: 'createdAt',
}

// ─── Counter buffer (30s flush) ─────────────────────────────
const BUFFER_INTERVAL_MS = 30_000
const counterBuffer = new Map() // key: `${collection}/${id}` → { id, collection, data }

function flushCounterBuffer() {
  if (counterBuffer.size === 0) return

  const entries = [...counterBuffer.values()]
  counterBuffer.clear()

  const byCollection = {}
  for (const e of entries) {
    if (!byCollection[e.collection]) byCollection[e.collection] = {}
    byCollection[e.collection][e.id] = e.data
  }

  for (const [collection, docs] of Object.entries(byCollection)) {
    const updates = Object.entries(docs).map(([id, data]) =>
      ts.collections(collection).documents().update({ ...data, id }).catch((err) => {
        console.warn(`⚠ Buffer flush failed for ${collection}/${id}:`, err?.message ?? err)
      })
    )
    Promise.all(updates).then(() => {
      console.log(`  📦 Flushed ${Object.keys(docs).length} ${collection} counter(s)`)
    })
  }
}

setInterval(flushCounterBuffer, BUFFER_INTERVAL_MS)

// ─── Helpers ────────────────────────────────────────────────
const COUNTER_FIELDS = new Set([
  'viewCount', 'likeCount', 'followerCount', 'followingCount',
  'videoCount', 'trendingScore', 'totalViews', 'postsCount',
])

function mapUser(doc) {
  const d = doc.data()
  return {
    id: doc.id,
    pseudo: d.pseudo ?? '',
    nom: d.nom ?? '',
    bio: d.bio ?? '',
    city: d.city ?? '',
    interests: Array.isArray(d.interests) ? d.interests.slice(0, 10) : [],
    photoURL: d.photoURL ?? '',
    verified: !!d.verified,
    followerCount: d.followerCount ?? 0,
  }
}

function mapHashtag(doc) {
  const d = doc.data()
  return {
    id: doc.id,
    tag: d.tag ?? doc.id,
    videoCount: d.videoCount ?? 0,
    trendingScore: d.trendingScore ?? 0,
  }
}

function mapPost(doc) {
  const d = doc.data()
  const ts = d.createdAt
  const createdAtMs = ts?.toMillis?.() ?? (ts?.seconds ? ts.seconds * 1000 : 0)
  const likeCount = d.likes ?? d.likeCount ?? 0
  const commentCount = d.commentCount ?? d.comments ?? 0
  const viewCount = d.viewCount ?? d.views ?? 0
  const media = Array.isArray(d.media) ? d.media : []
  const firstMedia = media[0]
  const mediaUrl = d.mediaUrl ?? firstMedia?.url ?? ''
  const thumbnailUrl = d.thumbnailUrl ?? d.thumbnailURL ?? firstMedia?.thumbnailUrl ?? mediaUrl
  const mediaType = d.mediaType ?? (firstMedia?.type ?? (media.length > 1 ? 'carousel' : (firstMedia ? 'image' : 'text')))
  return {
    id: doc.id,
    text: d.text ?? d.description ?? '',
    userName: d.userName ?? '',
    userId: d.userId ?? '',
    userPhoto: d.userPhoto ?? d.authorPhoto ?? '',
    likeCount,
    commentCount,
    viewCount,
    mediaType,
    mediaUrl,
    thumbnailUrl,
    createdAt: createdAtMs,
    visibility: d.visibility ?? 'public',
    moderationStatus: d.moderationStatus ?? 'approved',
    recencyScore: computeRecencyScore(likeCount, createdAtMs),
  }
}

/**
 * Boost les vidéos récentes : recencyScore = likeCount * exp(-age_days / 30).
 * Une vidéo d'il y a 30j avec 100 likes = 100/e ≈ 37 ; une vidéo d'aujourd'hui = likeCount.
 */
function computeRecencyScore(likeCount, createdAtMs) {
  if (!createdAtMs) return likeCount
  const ageDays = (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)
  return likeCount * Math.exp(-Math.max(ageDays, 0) / 30)
}

function hasCounterChanges(before, after) {
  if (!before || !after) return false
  for (const field of COUNTER_FIELDS) {
    if (before.data()[field] !== after.data()[field]) return true
  }
  return false
}

// ─── Backfill ───────────────────────────────────────────────
async function backfill() {
  console.log('\n🔄 Backfill: importing existing documents...')

  const usersSnap = await db.collection('users').get()
  const userDocs = usersSnap.docs.map(mapUser)
  if (userDocs.length) {
    await ts.collections('users').documents().import(userDocs, { action: 'upsert' })
    console.log(`  ✅ ${userDocs.length} users imported`)
  }

  const tagsSnap = await db.collection('hashtags').get()
  const tagDocs = tagsSnap.docs.map(mapHashtag).filter((h) => h.videoCount > 0)
  if (tagDocs.length) {
    await ts.collections('hashtags').documents().import(tagDocs, { action: 'upsert' })
    console.log(`  ✅ ${tagDocs.length} hashtags imported`)
  }

  // If no hashtag docs exist, build them from posts
  if (tagDocs.length === 0) {
    console.log('  📝 No hashtag docs found — building from posts...')
    const postsSnap = await db.collection('posts').get()
    const tagCounts = {}
    for (const post of postsSnap.docs) {
      const tags = post.data().hashtags ?? []
      for (const t of tags) {
        const tag = t.toLowerCase().trim()
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
      }
    }
    const batch = db.batch()
    for (const [tag, count] of Object.entries(tagCounts)) {
      batch.set(db.collection('hashtags').doc(tag), {
        tag,
        videoCount: count,
        trendingScore: count,
      }, { merge: true })
    }
    await batch.commit()
    console.log(`  ✅ Created ${Object.keys(tagCounts).length} hashtag docs in Firestore`)

    // Now import to Typesense
    const newTagsSnap = await db.collection('hashtags').get()
    const newTagDocs = newTagsSnap.docs.map(mapHashtag).filter((h) => h.videoCount > 0)
    if (newTagDocs.length) {
      await ts.collections('hashtags').documents().import(newTagDocs, { action: 'upsert' })
      console.log(`  ✅ ${newTagDocs.length} hashtags imported to Typesense`)
    }
  }

  // Posts backfill (all types: text, image, carousel, video, etc.)
  const postsSnap = await db.collection('posts').where('visibility', '==', 'public').orderBy('createdAt', 'desc').limit(500).get()
  const postDocs = postsSnap.docs.map(mapPost)
  if (postDocs.length) {
    await ts.collections('posts').documents().import(postDocs, { action: 'upsert' })
    console.log(`  ✅ ${postDocs.length} posts imported (all media types)`)
  }
}

// ─── Init schemas ──────────────────────────────────────────
async function initSchemas() {
  console.log('\n📐 Initializing Typesense schemas...')
  for (const schema of [USERS_SCHEMA, HASHTAGS_SCHEMA, POSTS_SCHEMA]) {
    await ts.collections(schema.name).delete().catch(() => {})
    await ts.collections().create(schema)
    console.log(`  ✅ Collection "${schema.name}" created`)
  }
}

// ─── Listeners ──────────────────────────────────────────────
function startListeners() {
  console.log('\n👂 Listening to Firestore changes...\n')

  // Users listener
  db.collection('users').onSnapshot((snap) => {
    for (const change of snap.docChanges()) {
      const { doc, type } = change

      if (type === 'added' || type === 'modified') {
        // Check if only counters changed → buffer instead of full upsert
        if (type === 'modified' && hasCounterChanges(change.doc, doc)) {
          const counterData = {}
          for (const field of COUNTER_FIELDS) {
            if (doc.data()[field] !== undefined) {
              counterData[field] = doc.data()[field]
            }
          }
          counterBuffer.set(`users/${doc.id}`, { id: doc.id, collection: 'users', data: counterData })
          continue
        }

        // Full upsert
        ts.collections('users').documents().upsert(mapUser(doc)).catch((err) => {
          console.warn(`⚠ Users upsert failed for ${doc.id}:`, err?.message ?? err)
        })
      } else if (type === 'removed') {
        ts.collections('users').documents(doc.id).delete().catch(() => {})
      }
    }
  })

  // Hashtags listener
  db.collection('hashtags').onSnapshot((snap) => {
    for (const change of snap.docChanges()) {
      const { doc, type } = change
      const data = doc.data()

      if (type === 'added' || type === 'modified') {
        const videoCount = data.videoCount ?? 0

        // Delete if videoCount <= 0
        if (videoCount <= 0) {
          ts.collections('hashtags').documents(doc.id).delete().catch(() => {})
          continue
        }

        // Check if only counters changed → buffer
        if (type === 'modified' && hasCounterChanges(change.doc, doc)) {
          counterBuffer.set(`hashtags/${doc.id}`, {
            id: doc.id,
            collection: 'hashtags',
            data: { videoCount: data.videoCount ?? 0, trendingScore: data.trendingScore ?? 0 },
          })
          continue
        }

        // Full upsert
        ts.collections('hashtags').documents().upsert(mapHashtag(doc)).catch((err) => {
          console.warn(`⚠ Hashtags upsert failed for ${doc.id}:`, err?.message ?? err)
        })
      } else if (type === 'removed') {
        ts.collections('hashtags').documents(doc.id).delete().catch(() => {})
      }
    }
  })

  // Posts listener (toutes publications : text, image, carousel, video, etc.)
  db.collection('posts').onSnapshot((snap) => {
    for (const change of snap.docChanges()) {
      const { doc, type } = change
      const data = doc.data()

      if (type === 'added' || type === 'modified') {
        // Check if only counters changed → buffer
        if (type === 'modified' && hasCounterChanges(change.doc, doc)) {
          counterBuffer.set(`posts/${doc.id}`, {
            id: doc.id,
            collection: 'posts',
            data: {
              likeCount: data.likes ?? data.likeCount ?? 0,
              commentCount: data.commentCount ?? data.comments ?? 0,
              viewCount: data.viewCount ?? data.views ?? 0,
            },
          })
          continue
        }

        // Full upsert
        ts.collections('posts').documents().upsert(mapPost(doc)).catch((err) => {
          console.warn(`⚠ Posts upsert failed for ${doc.id}:`, err?.message ?? err)
        })
      } else if (type === 'removed') {
        ts.collections('posts').documents(doc.id).delete().catch(() => {})
      }
    }
  })
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log('🚀 Typesense Sync — starting...')
  console.log(`   Host: ${TYPESENSE_HOST}`)

  await initSchemas()
  await backfill()
  startListeners()

  console.log('\n✅ Sync running. Press Ctrl+C to stop.\n')
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...')
  flushCounterBuffer()
  await new Promise((r) => setTimeout(r, 500))
  process.exit(0)
})

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
