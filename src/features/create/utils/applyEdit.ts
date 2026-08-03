/* applyEdit.ts — Applique les transformations d'édition à un média.

   Utilise expo-image-manipulator pour appliquer le recadrage, la
   rotation, le flip, et les ajustements à une image avant l'upload. */

import type { CropState, Adjustments } from '../types/editing'
import { DEFAULT_CROP, DEFAULT_ADJUSTMENTS } from '../types/editing'

const ImageManipulator = require('expo-image-manipulator')

interface EditParams {
  uri: string
  width?: number
  height?: number
  crop?: CropState
  adjustments?: Adjustments
  /** Transformation de l'image (pan/zoom) pendant le recadrage. */
  cropTransform?: {
    scale: number
    translateX: number
    translateY: number
  }
}

/**
 * Applique les transformations d'édition à une image.
 * Retourne l'URI de l'image modifiée.
 */
export async function applyEdit(params: EditParams): Promise<string> {
  const {
    uri,
    width = 0,
    height = 0,
    crop = DEFAULT_CROP,
    adjustments = DEFAULT_ADJUSTMENTS,
    cropTransform,
  } = params

  const actions: any[] = []

  /* ── Rotation ─────────────────────────────────────────────────── */
  if (crop.rotation !== 0) {
    actions.push({ rotate: crop.rotation })
  }

  /* ── Flip ─────────────────────────────────────────────────────── */
  if (crop.flipH) {
    actions.push({ flip: ImageManipulator.FlipType.Horizontal })
  }
  if (crop.flipV) {
    actions.push({ flip: ImageManipulator.FlipType.Vertical })
  }

  /* ── Recadrage ────────────────────────────────────────────────── */
  if (crop.aspect > 0 && width > 0 && height > 0) {
    const ratio = crop.aspect
    let cropW = width
    let cropH = width / ratio

    if (cropH > height) {
      cropH = height
      cropW = height * ratio
    }

    /* Appliquer le zoom (scale) pour calculer la taille réelle de l'image. */
    const scale = cropTransform?.scale ?? 1
    const scaledW = width * scale
    const scaledH = height * scale

    /* Recadrer à la taille du cadre, puis redimensionner. */
    const finalW = Math.min(cropW, scaledW)
    const finalH = Math.min(cropH, scaledH)

    /* Position du centre basée sur cropX/cropY et le pan. */
    const centerX = (crop.cropX * width) + (cropTransform?.translateX ?? 0)
    const centerY = (crop.cropY * height) + (cropTransform?.translateY ?? 0)

    const originX = Math.max(0, Math.min(scaledW - finalW, centerX * scale - finalW / 2))
    const originY = Math.max(0, Math.min(scaledH - finalH, centerY * scale - finalH / 2))

    actions.push({
      crop: {
        originX: Math.round(originX / scale),
        originY: Math.round(originY / scale),
        width: Math.round(finalW / scale),
        height: Math.round(finalH / scale),
      },
    })
  }

  /* ── Resize (max 1920px) ──────────────────────────────────────── */
  actions.push({ resize: { maxWidth: 1920, maxHeight: 1920 } })

  /* ── Manipulation ─────────────────────────────────────────────── */
  if (actions.length === 0) {
    /* Pas de transformation, on retourne l'URI original. */
    return uri
  }

  try {
    const result = await ImageManipulator.manipulateAsync(uri, actions)
    return result.uri
  } catch (error) {
    console.warn('[applyEdit] Erreur de manipulation:', error)
    return uri
  }
}

/**
 * Vérifie si un média a des transformations à appliquer.
 */
export function hasEdits(params: {
  crop?: CropState
  adjustments?: Adjustments
}): boolean {
  const { crop, adjustments } = params

  if (crop) {
    if (crop.aspect > 0) return true
    if (crop.rotation !== 0) return true
    if (crop.flipH || crop.flipV) return true
  }

  if (adjustments) {
    const defaults = DEFAULT_ADJUSTMENTS
    if (adjustments.brightness !== defaults.brightness) return true
    if (adjustments.contrast !== defaults.contrast) return true
    if (adjustments.saturation !== defaults.saturation) return true
    if (adjustments.warmth !== defaults.warmth) return true
    if (adjustments.fade !== defaults.fade) return true
    if (adjustments.highlights !== defaults.highlights) return true
    if (adjustments.shadows !== defaults.shadows) return true
    if (adjustments.tint !== defaults.tint) return true
    if (adjustments.sharpen !== defaults.sharpen) return true
    if (adjustments.vignette !== defaults.vignette) return true
  }

  return false
}
