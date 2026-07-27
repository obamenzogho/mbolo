/* positionTracker — mémorise la position de lecture par vidéo.
   Rôle : permettre à une vidéo de reprendre là où on l'a laissée quand on
   re-scrolle dessus DANS LA SESSION en cours.

   Portée SESSION uniquement : le cache est en mémoire, non persisté. Au
   redémarrage de l'app, toutes les vidéos repartent du début (choix produit).

   On ne mémorise PAS les positions triviales (< 2 s) ni les quasi-fins
   (> 95 %) : dans ces cas la vidéo doit repartir du début. */

const MIN_POSITION_S = 2 // en-deçà, on repart du début
const NEAR_END_RATIO = 0.95 // au-delà, on repart du début

let cache: Record<string, number> = {}

/** Enregistre la position courante (secondes) d'une vidéo. */
export function savePosition(videoId: string, positionS: number, durationS: number) {
  if (!videoId || !Number.isFinite(positionS) || !Number.isFinite(durationS) || durationS <= 0) return
  if (positionS < MIN_POSITION_S || positionS / durationS > NEAR_END_RATIO) {
    // Position triviale ou quasi-fin → aucune reprise mémorisée.
    if (cache[videoId] !== undefined) delete cache[videoId]
    return
  }
  cache[videoId] = positionS
}

/** Renvoie la position de reprise (secondes) ou 0 si aucune. */
export function getPosition(videoId: string): number {
  return cache[videoId] ?? 0
}

// Alias explicite côté player pool.
export const getResumePosition = getPosition

export function clearPosition(videoId: string) {
  if (cache[videoId] !== undefined) delete cache[videoId]
}

/** Vide tout le cache (ex. déconnexion). */
export function clearAllPositions() {
  cache = {}
}
