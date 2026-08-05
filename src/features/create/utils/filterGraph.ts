/* src/features/create/utils/filterGraph.ts

   Traduit l'état d'édition (crop, filtre, effet, ajustements) en une chaîne
   de filtres FFmpeg. Pur et sans dépendance : testable, et partagé par le
   rendu photo et le rendu vidéo — une seule vérité pour les deux médias. */

import type { Adjustments, CropState, FilterDeltas } from '../types/editing'
import { DEFAULT_ADJUSTMENTS, DEFAULT_CROP, getCropAspect, getEffect, getFilter } from '../types/editing'
import { cropWindow, cropPosition, MAX_CROP_ZOOM } from './cropGeometry'

export interface GraphInput {
  width: number
  height: number
  crop?: CropState
  cropTransform?: { scale: number; translateX: number; translateY: number }
  filterId?: string
  filterIntensity?: number
  effectId?: string
  effectIntensity?: number
  adjustments?: Adjustments
  /** Côté max de sortie. 1080 = standard Instagram. */
  maxSize?: number
  /** Mode de géométrie : 'all' = tout, 'straighten' = straighten + couleur uniquement (proxy crop tab). */
  geometryMode?: 'all' | 'color'
}

export interface FilterChain {
  /** Chaîne prête pour -vf ou filter_complex. Jamais vide (au pire 'null'). */
  chain: string
  /** Dimensions de sortie — nécessaires pour caler l'overlay PNG. */
  width: number
  height: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const r3 = (v: number) => Math.round(v * 1000) / 1000
/** libx264 exige des dimensions paires. */
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

type Deltas = Required<FilterDeltas>
const ZERO: Deltas = {
  brightness: 0, contrast: 0, saturate: 0, hue: 0,
  sepia: 0, grayscale: 0, blur: 0, invert: 0,
}

function scaleDeltas(d: FilterDeltas, intensity = 100): Deltas {
  const k = clamp(intensity, 0, 100) / 100
  return {
    brightness: (d.brightness ?? 0) * k,
    contrast: (d.contrast ?? 0) * k,
    saturate: (d.saturate ?? 0) * k,
    hue: (d.hue ?? 0) * k,
    sepia: (d.sepia ?? 0) * k,
    grayscale: (d.grayscale ?? 0) * k,
    blur: (d.blur ?? 0) * k,
    invert: (d.invert ?? 0) * k,
  }
}

function addDeltas(a: Deltas, b: Deltas): Deltas {
  return {
    brightness: a.brightness + b.brightness,
    contrast: a.contrast + b.contrast,
    saturate: a.saturate + b.saturate,
    hue: a.hue + b.hue,
    sepia: clamp(a.sepia + b.sepia, 0, 1),
    grayscale: clamp(a.grayscale + b.grayscale, 0, 1),
    blur: a.blur + b.blur,
    invert: clamp(a.invert + b.invert, 0, 1),
  }
}

/* ── Géométrie : flip → rotation 90° → straighten → recadrage → resize ── */

function buildGeometry(input: GraphInput, out: string[]): { w: number; h: number } {
  const crop = input.crop ?? DEFAULT_CROP
  let w = input.width || 1080
  let h = input.height || 1080
  const mode = input.geometryMode ?? 'all'

  /* Flip — seulement en mode 'all' (pas en proxy crop tab). */
  if (mode === 'all') {
    if (crop.flipH) out.push('hflip')
    if (crop.flipV) out.push('vflip')

    /* Rotation 90° — swap les dims. */
    const rot = ((crop.rotation % 360) + 360) % 360
    if (rot === 90) { out.push('transpose=1'); [w, h] = [h, w] }
    else if (rot === 180) { out.push('transpose=1,transpose=1') }
    else if (rot === 270) { out.push('transpose=2'); [w, h] = [h, w] }
  }

  /* Straighten (-45..45) — appliqué uniquement en mode 'all'.
     En mode 'color' (proxy crop tab), la géométrie est gérée en live. */
  const straighten = crop.straighten ?? 0
  if (mode === 'all' && straighten !== 0) {
    const a = (straighten * Math.PI) / 180
    const c = Math.abs(Math.cos(a))
    const s = Math.abs(Math.sin(a))
    const zoom = Math.max((w * c + h * s) / w, (w * s + h * c) / h)
    out.push(`scale=${even(w * zoom)}:${even(h * zoom)}`)
    out.push(`rotate=${r3(a)}:ow=iw:oh=ih`)
    out.push(`crop=${even(w)}:${even(h)}`)
  }

  /* Aspect crop — seulement en mode 'all'. */
  const cropAspect = getCropAspect(crop)
  if (mode === 'all' && cropAspect > 0) {
    const zoom = clamp(input.cropTransform?.scale ?? 1, 1, MAX_CROP_ZOOM)
    const { cw, ch } = cropWindow(w, h, cropAspect, zoom)
    const { x: px, y: py } = cropPosition(
      w, h, cw, ch,
      crop.cropX, crop.cropY,
      input.cropTransform?.translateX ?? 0,
      input.cropTransform?.translateY ?? 0,
    )

    w = even(cw); h = even(ch)
    out.push(`crop=${w}:${h}:${px}:${py}`)
  }

  const max = input.maxSize ?? 1080
  if (Math.max(w, h) > max) {
    const k = max / Math.max(w, h)
    w = even(w * k); h = even(h * k)
    out.push(`scale=${w}:${h}:flags=lanczos`)
  }

  return { w, h }
}

/* ── Couleur : filtre + effet + ajustements manuels ───────────────── */

function buildColor(input: GraphInput, out: string[]): void {
  const adj = input.adjustments ?? DEFAULT_ADJUSTMENTS
  const d = addDeltas(
    scaleDeltas(getFilter(input.filterId ?? 'none').deltas, input.filterIntensity ?? 100),
    scaleDeltas(getEffect(input.effectId ?? 'ef-none').deltas, input.effectIntensity ?? 100),
  )

  if (d.invert >= 0.5) out.push('negate')
  if (d.hue !== 0) out.push(`hue=h=${r3(d.hue)}`)

  /* Warmth : 6500K = neutre. +100 → chaud (3500K), -100 → froid (9500K). */
  if (adj.warmth !== 0) {
    out.push(`colortemperature=temperature=${Math.round(6500 - adj.warmth * 30)}:mix=1`)
  }

  /* Tint : vert ↔ magenta. */
  if (adj.tint !== 0) {
    const t = r3(adj.tint / 300)
    out.push(`colorbalance=rm=${t}:bm=${t}:gm=${r3(-t)}`)
  }

  const brightness = clamp(adj.brightness / 200 + d.brightness, -1, 1)
  const contrast = clamp(1 + adj.contrast / 100 + d.contrast, 0, 3)
  const saturation = clamp(1 + adj.saturation / 100 + d.saturate, 0, 3)
  if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
    out.push(`eq=brightness=${r3(brightness)}:contrast=${r3(contrast)}:saturation=${r3(saturation)}`)
  }

  /* Shadows / highlights / fade : une courbe à 3 points, comme Lightroom. */
  const fade = adj.fade / 100
  const y0 = clamp(adj.shadows / 400 + Math.max(0, fade) * 0.15, 0, 0.4)
  const y1 = clamp(1 + adj.highlights / 400 - Math.max(0, fade) * 0.1, 0.6, 1)
  if (y0 !== 0 || y1 !== 1) {
    out.push(`curves=all='0/${r3(y0)} 0.5/0.5 1/${r3(y1)}'`)
  }

  if (d.sepia > 0) {
    const s = d.sepia
    out.push(
      'colorchannelmixer=' +
      `${r3(1 - s + 0.393 * s)}:${r3(0.769 * s)}:${r3(0.189 * s)}:0:` +
      `${r3(0.349 * s)}:${r3(1 - s + 0.686 * s)}:${r3(0.168 * s)}:0:` +
      `${r3(0.272 * s)}:${r3(0.534 * s)}:${r3(1 - s + 0.131 * s)}:0`,
    )
  }

  if (d.grayscale > 0) {
    const g = d.grayscale
    out.push(
      'colorchannelmixer=' +
      `${r3(1 - g + 0.299 * g)}:${r3(0.587 * g)}:${r3(0.114 * g)}:0:` +
      `${r3(0.299 * g)}:${r3(1 - g + 0.587 * g)}:${r3(0.114 * g)}:0:` +
      `${r3(0.299 * g)}:${r3(0.587 * g)}:${r3(1 - g + 0.114 * g)}:0`,
    )
  }

  if (adj.sharpen > 0) out.push(`unsharp=5:5:${r3((adj.sharpen / 100) * 1.5)}`)
  if (d.blur > 0) out.push(`gblur=sigma=${r3(d.blur)}`)
  if (adj.vignette > 0) out.push(`vignette=angle=PI/${r3(6 - (adj.vignette / 100) * 3)}`)
}

/** Construit la chaîne complète. Toujours terminée par un format sûr. */
export function buildFilterChain(input: GraphInput): FilterChain {
  const parts: string[] = []
  const { w, h } = buildGeometry(input, parts)
  buildColor(input, parts)
  parts.push('format=yuv420p')
  return { chain: parts.join(','), width: w, height: h }
}

/** Y a-t-il quoi que ce soit à rendre ? Évite un ré-encodage inutile. */
export function needsRender(input: GraphInput & { overlayCount?: number }): boolean {
  const crop = input.crop ?? DEFAULT_CROP
  const adj = input.adjustments ?? DEFAULT_ADJUSTMENTS
  const mode = input.geometryMode ?? 'all'
  if (mode === 'all') {
    if (getCropAspect(crop) > 0 || crop.rotation !== 0 || crop.flipH || crop.flipV) return true
  }
  if (mode === 'all' && (crop.straighten ?? 0) !== 0) return true
  if ((input.filterId ?? 'none') !== 'none') return true
  if ((input.effectId ?? 'ef-none') !== 'ef-none') return true
  if ((input.overlayCount ?? 0) > 0) return true
  return (Object.keys(adj) as (keyof Adjustments)[]).some((k) => adj[k] !== DEFAULT_ADJUSTMENTS[k])
}
