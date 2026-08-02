import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

/* ─────────────────────────────────────────────────────────────
   ANTI-SPAM À LA CRÉATION DE POST — quota par auteur

   Le mobile écrit directement dans `posts` (les règles Firestore valident
   le document, pas la fréquence). Cette fonction impose un quota glissant
   par auteur, stocké dans `rateLimits/posts/{uid}` — collection backend
   uniquement, refusée au mobile par défaut (aucune règle à écrire).

   Au-delà du quota, le post vient d'être créé est supprimé récursivement :
   le spam disparaît même d'un client malveillant. Le mobile applique déjà
   un garde-fou applicatif (cooldown dans useComposePublish) ; celui-ci est
   la sécurité de fond, inaltérable côté client.

   Le compteur n'est jamais un frein pour un usage normal : 30 publications
   par heure dépassent largement le rythme d'un humain, même actif.
   ───────────────────────────────────────────────────────────── */

/** Publications autorisées par fenêtre glissante, par auteur. */
const POST_CREATE_MAX = 30

/** Fenêtre du compteur : 1 heure. */
const POST_CREATE_WINDOW_MS = 60 * 60 * 1000

export const onPostCreateRateLimit = onDocumentCreated(
  'posts/{postId}',
  async (event) => {
    const uid = event.data?.data()?.userId
    if (!uid) return

    const db = getFirestore()
    const counterRef = db.doc(`rateLimits/posts/${uid}`)
    const now = Date.now()

    let overQuota = false

    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef)
        const prev = snap.exists ? snap.data() : undefined
        const prevStart =
          typeof prev?.windowStart === 'number' ? prev.windowStart : now

        const count =
          now - prevStart < POST_CREATE_WINDOW_MS
            ? (prev?.count ?? 0) + 1
            : 1

        tx.set(counterRef, {
          windowStart: count === 1 ? now : prevStart,
          count,
        })

        if (count > POST_CREATE_MAX) overQuota = true
      })
    } catch (err) {
      // Un échec du compteur ne doit jamais bloquer une création légitime.
      console.warn('rate-limit posts:', (err as Error)?.message ?? err)
      return
    }

    if (overQuota) {
      /* Le post excédentaire est retiré, sous-collections incluses
         (commentaires éventuels), et le compteur public est corrigé. */
      await db
        .recursiveDelete(db.doc(`posts/${event.params.postId}`))
        .catch((err) => console.warn('rate-limit revert:', (err as Error)?.message ?? err))

      await db
        .doc(`users/${uid}`)
        .update({ postsCount: FieldValue.increment(-1) })
        .catch(() => {})
    }
  },
)
