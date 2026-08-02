import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { getFirestore } from 'firebase-admin/firestore'

/* ─────────────────────────────────────────────────────────────
   ANTI-SPAM À LA CRÉATION DE VIDÉO — quota par auteur

   Miroir de `onPostCreateRateLimit` pour la collection `videos`, alimentée
   par le nouveau flux de création unifié. Le mobile écrit directement dans
   `videos` : les règles Firestore valident le document, pas la fréquence.
   Cette fonction impose un quota glissant par auteur, stocké dans
   `rateLimits/videos/{uid}` — collection backend uniquement.

   Au-delà du quota, la vidéo vient d'être créée est supprimée récursivement
   (sous-collections de likes/commentaires éventuelles). Un usage normal ne
   s'en approche jamais : 15 vidéos/heure est déjà très au-dessus d'un
   rythme humain.
   ───────────────────────────────────────────────────────────── */

/** Vidéos autorisées par fenêtre glissante, par auteur. */
const VIDEO_CREATE_MAX = 15

/** Fenêtre du compteur : 1 heure. */
const VIDEO_CREATE_WINDOW_MS = 60 * 60 * 1000

export const onVideoCreateRateLimit = onDocumentCreated(
  'videos/{videoId}',
  async (event) => {
    const uid = event.data?.data()?.userId
    if (!uid) return

    const db = getFirestore()
    const counterRef = db.doc(`rateLimits/videos/${uid}`)
    const now = Date.now()

    let overQuota = false

    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef)
        const prev = snap.exists ? snap.data() : undefined
        const prevStart =
          typeof prev?.windowStart === 'number' ? prev.windowStart : now

        const count =
          now - prevStart < VIDEO_CREATE_WINDOW_MS
            ? (prev?.count ?? 0) + 1
            : 1

        tx.set(counterRef, {
          windowStart: count === 1 ? now : prevStart,
          count,
        })

        if (count > VIDEO_CREATE_MAX) overQuota = true
      })
    } catch (err) {
      // Un échec du compteur ne doit jamais bloquer une création légitime.
      console.warn('rate-limit videos:', (err as Error)?.message ?? err)
      return
    }

    if (overQuota) {
      await db
        .recursiveDelete(db.doc(`videos/${event.params.videoId}`))
        .catch((err) => console.warn('rate-limit video revert:', (err as Error)?.message ?? err))
    }
  },
)
