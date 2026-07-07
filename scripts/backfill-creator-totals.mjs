// scripts/backfill-creator-totals.mjs
// GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/backfill-creator-totals.mjs
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const sa = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
initializeApp({ credential: cert(sa) })
const db = getFirestore()

const videos = await db.collection('videos').get()
const totals = {}

videos.forEach((v) => {
  const d = v.data()
  const uid = d.userId
  if (!uid) return
  totals[uid] ??= { views: 0, likes: 0, shares: 0, comments: 0 }
  totals[uid].views += d.views ?? 0
  totals[uid].likes += d.likes ?? 0
  totals[uid].shares += d.shares ?? 0
  totals[uid].comments += d.comments ?? 0
})

let batch = db.batch(); let ops = 0
for (const [uid, t] of Object.entries(totals)) {
  batch.set(db.doc(`users/${uid}`), {
    totalViews: t.views, totalLikes: t.likes, totalShares: t.shares, totalComments: t.comments,
  }, { merge: true })
  if (++ops >= 400) { await batch.commit(); batch = db.batch(); ops = 0 }
}
if (ops > 0) await batch.commit()
console.log(`✅ Backfill terminé pour ${Object.keys(totals).length} créateurs`)
process.exit(0)
