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
 *
 * Paramètre optionnel forceQuality :
 *   'LOW'  → force 360p (pré-chargement NEXT)
 *   'MEDIUM' → force 480p
 *   'HIGH' → force 720p
 *   undefined → utilise la qualité réseau (comportement par défaut)
 */

import { NetworkQuality } from './NetworkQuality'
import type { Video } from '../../../types'

type QualityOverride = 'LOW' | 'MEDIUM' | 'HIGH'

function resolveByQuality(video: Video, quality: 'FAST' | 'MEDIUM' | 'SLOW'): string {
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

function resolveByForce(video: Video, force: QualityOverride): string {
  if (force === 'LOW') {
    return video.videoURL_360p ?? video.videoURL
  }
  if (force === 'MEDIUM') {
    return video.videoURL_480p ?? video.videoURL
  }
  if (force === 'HIGH') {
    return video.videoURL_720p ?? video.videoURL_480p ?? video.videoURL
  }
  return video.videoURL
}

export function resolveVideoUrl(video: Video, forceQuality?: QualityOverride): string {
  if (forceQuality) {
    return resolveByForce(video, forceQuality)
  }
  return resolveByQuality(video, NetworkQuality.get())
}
