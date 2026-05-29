/**
 * resolveVideoUrl.ts
 *
 * Point unique de décision ABR (Adaptive Bitrate).
 * Choisit l'URL vidéo optimale selon la qualité réseau
 * mesurée passivement par NetworkQuality.
 *
 * Grille de qualité :
 *   FAST   (>5 Mbps)  → 720p › 480p › source
 *   MEDIUM (1-5 Mbps) → 480p › source
 *   SLOW   (<1 Mbps)  → 360p › source
 *
 * Le fallback ?? videoURL garantit la compatibilité
 * avec les vidéos existantes sans champ 720p/480p/360p.
 * Dès que le pipeline backend écrira videoURL_720p,
 * les clients FAST basculent automatiquement sans
 * mise à jour de l'app.
 */

import { NetworkQuality } from './NetworkQuality'
import type { Video } from '../../../types'

export function resolveVideoUrl(video: Video): string {
  const quality = NetworkQuality.get()

  if (quality === 'FAST') {
    return video.videoURL_720p
        ?? video.videoURL_480p
        ?? video.videoURL
  }
  if (quality === 'MEDIUM') {
    return video.videoURL_480p
        ?? video.videoURL
  }
  if (quality === 'SLOW') {
    return video.videoURL_360p
        ?? video.videoURL
  }
  return video.videoURL
}
