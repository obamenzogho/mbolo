/**
 * Migration script — génère thumbnailURL pour les documents vidéo existants.
 *
 * USAGE :
 * 1. Télécharger serviceAccountKey.json depuis
 *    Firebase Console → Project Settings →
 *    Service Accounts → Generate new private key
 *
 * 2. Dry run (recommandé en premier) :
 *    npx ts-node scripts/migrate-thumbnails.ts --dry-run
 *
 * 3. Migration réelle :
 *    npx ts-node scripts/migrate-thumbnails.ts
 *
 * 4. NE PAS committer serviceAccountKey.json
 *    Vérifier que .gitignore contient :
 *    serviceAccountKey.json
 */

import { createRequire } from 'module'
import https from 'https'
import fs from 'fs'

const _require = createRequire(import.meta.url)
const admin = _require('firebase-admin')

const isDryRun = process.argv.includes('--dry-run')

const CLOUDINARY_BASE = 'res.cloudinary.com'

function generateThumbnailURL(videoURL: string | null | undefined): string | null {
  if (!videoURL) return null
  if (videoURL.startsWith('file://')) return null
  if (!videoURL.includes(CLOUDINARY_BASE)) return null
  try {
    return videoURL
      .replace('/upload/', '/upload/so_0,f_jpg,w_400,h_711,c_fill/')
      .replace(/\.(mp4|mov|webm|avi)(\?.*)?$/, '.jpg')
  } catch {
    return null
  }
}

function getGoogleTime(): Promise<number> {
  return new Promise((resolve, reject) => {
    https.get('https://firestore.googleapis.com', { timeout: 5000 }, (res) => {
      const dateStr = res.headers.date
      if (!dateStr) return reject(new Error('No Date header'))
      resolve(new Date(dateStr).getTime())
      res.destroy()
    }).on('error', reject).on('timeout', () => { reject(new Error('timeout')) })
  })
}

async function migrate() {
  // Récupérer le temps Google et patcher Date.now pour compenser le skew
  const googleTime = await getGoogleTime()
  const localTime = Date.now()
  const skew = googleTime - localTime
  if (Math.abs(skew) > 5000) {
    console.log(`⏰ Clock skew detected: ${Math.round(skew / 1000)}s — patching Date.now`)
    const origNow = Date.now
    Date.now = () => origNow() + skew
  } else {
    console.log('⏰ Clock is in sync')
  }

  const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf-8'))

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  const db = admin.firestore()
  console.log('Fetching all video documents...')
  const snapshot = await db.collection('videos').get()
  console.log(`Found ${snapshot.size} documents\n`)

  let migrated = 0
  let corrupted = 0
  let skipped = 0
  let errors = 0

  const batch = db.batch()
  let batchCount = 0

  function flushBatch() {
    if (batchCount === 0) return Promise.resolve()
    if (isDryRun) {
      console.log(`  [DRY] would commit batch of ${batchCount}`)
      batchCount = 0
      return Promise.resolve()
    }
    return batch.commit().then(() => {
      console.log(`  Committed batch of ${batchCount}`)
      batchCount = 0
    })
  }

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data()
      const videoURL = data.videoURL as string | undefined

      if (!videoURL) {
        skipped++
        console.log('SKIP:', doc.id, '— no videoURL')
        continue
      }

      // CAS 2 — file:/// path
      if (videoURL.startsWith('file:///')) {
        if (!isDryRun) {
          batch.update(doc.ref, { corrupted: true })
          batchCount++
        }
        console.log('CORRUPTED:', doc.id, '→', videoURL.slice(0, 50) + '...')
        corrupted++
      }
      // CAS 1 — Cloudinary URL sans thumbnail
      else if (
        videoURL.includes(CLOUDINARY_BASE) &&
        !data.thumbnailURL
      ) {
        const thumb = generateThumbnailURL(videoURL)
        if (thumb) {
          if (!isDryRun) {
            batch.update(doc.ref, { thumbnailURL: thumb })
            batchCount++
          }
          console.log('MIGRATED:', doc.id, '→', thumb)
          migrated++
        } else {
          errors++
          console.error('ERROR:', doc.id, '— generateThumbnailURL returned null for:', videoURL)
        }
      }
      // CAS 3 — déjà OK
      else {
        console.log('SKIP:', doc.id, '— already migrated or non-Cloudinary URL')
        skipped++
      }

      if (batchCount >= 400) {
        await flushBatch()
      }
    } catch (err) {
      errors++
      console.error('ERROR:', doc.id, err)
    }
  }

  await flushBatch()

  console.log('\n── Résultat ──────────────────')
  console.log('Scannés  :', snapshot.size)
  console.log('Migrés   :', migrated)
  console.log('Corrompus:', corrupted)
  console.log('Skippés  :', skipped)
  console.log('Erreurs  :', errors)
  if (isDryRun) {
    console.log('\n⚠️  DRY RUN — rien écrit dans Firestore')
  } else {
    console.log('\n✅  Migration terminée')
  }
}

migrate().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
