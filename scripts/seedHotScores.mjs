import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credPath) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your serviceAccountKey.json before running.')
  process.exit(1)
}
const dryRun = process.env.DRY_RUN === '1'
console.log(dryRun ? '[DRY RUN] no writes' : '[LIVE] seeding hotScore on all videos')

initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf8'))) })
const db = getFirestore()

const HOT_FRESHNESS_TAU = 36
function computeHotScore(data, now = Date.now()) {
  const engagement =
    Math.log1p(data.likes ?? 0) * 1.0 +
    Math.log1p(data.comments ?? 0) * 1.5 +
    Math.log1p(data.shares ?? 0) * 2.0 +
    Math.log1p(data.saves ?? 0) * 1.8
  const createdMs = data.createdAt?.toMillis?.() ?? now
  const ageHours = Math.max(0, (now - createdMs) / 3_600_000)
  const freshness = Math.exp(-ageHours / HOT_FRESHNESS_TAU)
  return Number((engagement * 1.0 + freshness * 4.0).toFixed(4))
}

async function main() {
  let lastDoc = null
  let processed = 0
  for (;;) {
    let q = db.collection('videos').orderBy('__name__').limit(300)
    if (lastDoc) q = q.startAfter(lastDoc)
    const snap = await q.get()
    if (snap.empty) break
    const batch = db.batch()
    let ops = 0
    for (const d of snap.docs) {
      const hotScore = computeHotScore(d.data())
      if (d.data().hotScore === hotScore) continue
      if (dryRun) {
        console.log(`[DRY] ${d.id} -> ${hotScore}`)
      } else {
        batch.update(d.ref, { hotScore, hotScoreUpdatedAt: FieldValue.serverTimestamp() })
        ops++
      }
    }
    if (!dryRun && ops > 0) await batch.commit()
    processed += snap.docs.length
    if (snap.docs.length < 300) break
    lastDoc = snap.docs[snap.docs.length - 1]
  }
  console.log(`Done. ${processed} videos scanned.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
