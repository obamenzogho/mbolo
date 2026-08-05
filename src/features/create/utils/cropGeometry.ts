/* cropGeometry.ts — Géométrie de recadrage partagée (pure, sans RN).

   Fournit les calculs de base utilisés par :
   - filterGraph (export FFmpeg)
   - CropOverlay (aperçu live, conversion px preview↔source)
   - EditPreview (taille du cadre, cover-fit)

   Un seul endroit pour la vérité géométrique : si le calcul change,
   preview et export changent ensemble. */

import type { CropState } from '../types/editing'

/** Zoom maximal autorisé pour le crop. */
export const MAX_CROP_ZOOM = 3

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ── Canvas post-rotation ──────────────────────────────────────── */

/** Dims du canvas après rotation 90/180/270 (flip ne change pas les dims). */
export function rotatedCanvas(
  srcW: number,
  srcH: number,
  rotation: number,
): { w: number; h: number } {
  const rot = ((rotation % 360) + 360) % 360
  return rot === 90 || rot === 270
    ? { w: srcH, h: srcW }
    : { w: srcW, h: srcH }
}

/* ── Fenêtre de crop ───────────────────────────────────────────── */

/** Plus grand rectangle d'aspect `aspect` dans (w,h), réduit par zoom. */
export function cropWindow(
  w: number,
  h: number,
  aspect: number,
  zoom: number,
): { cw: number; ch: number } {
  let cw = w
  let ch = w / aspect
  if (ch > h) {
    ch = h
    cw = h * aspect
  }
  const z = clamp(zoom, 1, MAX_CROP_ZOOM)
  return { cw: cw / z, ch: ch / z }
}

/** Position (x,y) de la fenêtre dans le canvas, avec pan en pixels source. */
export function cropPosition(
  w: number,
  h: number,
  cw: number,
  ch: number,
  cropX: number,
  cropY: number,
  panX: number,
  panY: number,
): { x: number; y: number } {
  const maxX = Math.max(0, w - cw)
  const maxY = Math.max(0, h - ch)
  return {
    x: Math.round(clamp(cropX * w - cw / 2 - panX, 0, maxX)),
    y: Math.round(clamp(cropY * h - ch / 2 - panY, 0, maxY)),
  }
}

/* ── Cover-fit pour l'aperçu ──────────────────────────────────── */

/** Taille cover-fit d'un image (W×H) dans un cadre (frameW×frameH). */
export function coverFit(
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
): { w: number; h: number } {
  const scale = Math.max(frameW / imgW, frameH / imgH)
  return { w: imgW * scale, h: imgH * scale }
}

/* ── Bornes de pan (pixels preview) ───────────────────────────── */

/** Bornes de pan preview (px) : ±(rendu - cadre)/2. */
export function panBounds(
  renderedW: number,
  renderedH: number,
  frameW: number,
  frameH: number,
  zoom: number,
): { maxX: number; maxY: number } {
  return {
    maxX: Math.max(0, (zoom * renderedW - frameW) / 2),
    maxY: Math.max(0, (zoom * renderedH - frameH) / 2),
  }
}

/* ── Conversion pan preview ↔ source ──────────────────────────── */

/** Convertit un pan preview (px) en pan source (px). */
export function panPreviewToSource(
  previewPx: number,
  canvasDim: number,
  renderedDim: number,
  zoom: number,
): number {
  const displayed = zoom * renderedDim
  return displayed > 0 ? (previewPx * canvasDim) / displayed : 0
}

/** Convertit un pan source (px) en pan preview (px). */
export function panSourceToPreview(
  sourcePx: number,
  canvasDim: number,
  renderedDim: number,
  zoom: number,
): number {
  const displayed = zoom * renderedDim
  return displayed > 0 ? (sourcePx * displayed) / canvasDim : 0
}
