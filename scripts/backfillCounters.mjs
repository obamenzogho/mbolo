import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!credPath) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your serviceAccountKey.json before running.')
  process.exit(1)
}
const dryRun = process.env.DRY_RUN === '1'
console.log(dryRun ? '[DRY RUN] no writes will be performed' : '[LIVE] writing recomputed counters')

initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf8'))) })
const db = getFirestore()
const BATCH = 200

async function backfillVideo(v) {
  const id = v.id
  const [likesSnap, savesSnap, commentsSnap, viewsSnap, repostsSnap, sharesSnap] = await Promise.all([
    v.ref.collection('likes').get(),
    v.ref.collection('saves').get(),
    v.ref.collection('comments').get(),
    v.ref.collection('views').get(),
    db.collection('reposts').where('postId', '==', id).get(),
    db.collection('shares').where('postId', '==', id).get(),
  ])

  const likedBy = likesSnap.docs.map((d) => d.id)
  const savedBy = savesSnap.docs.map((d) => d.id)

  let comments = commentsSnap.size
  for (const c of commentsSnap.docs) {
    const rSnap = await c.ref.collection('replies').get()
    comments += rSnap.size
  }

  const commentList = commentsSnap.docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .sort((a, b) => (b.data.createdAt?.toMillis?.() ?? 0) - (a.data.createdAt?.toMillis?.() ?? 0))
  const previewComments = commentList.slice(0, 3).map((c) => ({
    id: c.id,
    text: c.data.text ?? '',
    authorName: c.data.authorName ?? 'Utilisateur',
    authorPhoto: c.data.authorPhoto ?? null,
    likes: c.data.likes ?? 0,
  }))

  const repostedBy = repostsSnap.docs.map((d) => d.data().userId).filter(Boolean)
  const lastRepost = repostsSnap.docs[repostsSnap.docs.length - 1]?.data()
  const latestRepostedBy = lastRepost
    ? { userId: lastRepost.userId, userName: lastRepost.userName ?? lastRepost.userId }
    : FieldValue.delete()

  const update = {
    likes: likedBy.length,
    likedBy,
    saves: savedBy.length,
    savedBy,
    comments,
    previewComments,
    reposts: repostedBy.length,
    repostedBy,
    latestRepostedBy,
    shares: sharesSnap.size,
    views: viewsSnap.size,
  }

  if (dryRun) {
    console.log(`[DRY] ${id}`, JSON.stringify(update))
  } else {
    await v.ref.update(update)
    console.log(`[OK] ${id}`)
  }
}

async function main() {
  let lastDoc = null
  let processed = 0
  for (;;) {
    let q = db.collection('videos').orderBy('__name__').limit(BATCH)
    if (lastDoc) q = q.startAfter(lastDoc)
    const snap = await q.get()
    if (snap.empty) break
    for (const v of snap.docs) {
      await backfillVideo(v)
      processed++
    }
    if (snap.docs.length < BATCH) break
    lastDoc = snap.docs[snap.docs.length - 1]
  }
  console.log(`Done. ${processed} videos processed.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
