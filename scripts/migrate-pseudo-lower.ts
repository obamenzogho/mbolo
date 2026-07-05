/**
 * Migration one-shot : ajoute pseudoLower à tous les users existants.
 *
 * USAGE :
 * 1. Avoir un serviceAccountKey.json à la racine du projet
 *    (Firebase Console → Project Settings → Service Accounts → Generate new private key)
 *
 * 2. Dry run :
 *    npx ts-node scripts/migrate-pseudo-lower.ts --dry-run
 *
 * 3. Migration réelle :
 *    npx ts-node scripts/migrate-pseudo-lower.ts
 */

import { createRequire } from 'module'

const _require = createRequire(import.meta.url)
const admin = _require('firebase-admin')

const isDryRun = process.argv.includes('--dry-run')

try {
  const serviceAccount = _require('../serviceAccountKey.json')
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
} catch {
  admin.initializeApp({ credential: admin.applicationDefault() })
}

const db = admin.firestore()
const BATCH_SIZE = 500

async function migrate() {
  let migrated = 0
  let skipped = 0
  let lastDoc: any | undefined

  while (true) {
    let q = db.collection('users').orderBy('__name__').limit(BATCH_SIZE)
    if (lastDoc) q = q.startAfter(lastDoc)

    const snap = await q.get()
    if (snap.empty) break

    if (isDryRun) {
      for (const doc of snap.docs) {
        const data = doc.data()
        if (data.pseudoLower || !data.pseudo) {
          skipped++
          continue
        }
        console.log(`  [dry-run] would update ${doc.id}: pseudo="${data.pseudo}" → pseudoLower="${data.pseudo.toLowerCase()}"`)
        migrated++
      }
      lastDoc = snap.docs[snap.docs.length - 1]
      continue
    }

    const batch = db.batch()
    for (const doc of snap.docs) {
      const data = doc.data()
      if (data.pseudoLower) {
        skipped++
        continue
      }
      const pseudo: string | undefined = data.pseudo
      if (!pseudo) {
        skipped++
        continue
      }
      batch.update(doc.ref, { pseudoLower: pseudo.toLowerCase() })
      migrated++
    }

    await batch.commit()
    lastDoc = snap.docs[snap.docs.length - 1]
    console.log(`  migrated: ${migrated}, skipped: ${skipped}`)
  }

  console.log(`\nTerminé. ${migrated} users migrés, ${skipped} ignorés.`)
}

migrate().catch((e) => {
  console.error('Migration failed:', e)
  process.exit(1)
})
