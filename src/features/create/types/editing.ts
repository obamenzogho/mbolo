/* src/features/create/types/editing.ts

   Types pour l'édition des médias dans le flux de création. Portés du
   prototype createPost-instagram (EditScreen, VideoEditor).

   Chaque type est optionnel dans SelectedMedia : les anciens chemins
   (caméra, composeur riche) ne les remplissent pas, et les valeurs
   par défaut signifient « pas d'édition ». */

/* ── Crop & rotation ─────────────────────────────────────────────── */

export interface CropState {
  /** Rapport d'aspect de recadrage. 0 = original, 1 = carré, 0.8 = 4:5. */
  aspect: number
  /** Ratio arbitraire choisi dans le mode libre. Prévaut sur `aspect`. */
  freeformAspect?: number
  /** Rotation en degrés, incrément de 90° (0, 90, 180, 270). */
  rotation: number
  /** Redressement libre -45..45° (appliqué après la rotation 90°). 0 par défaut. */
  straighten?: number
  flipH: boolean
  flipV: boolean
  /** Position X du centre de la zone de recadrage (0-1, relatif à l'image). */
  cropX: number
  /** Position Y du centre de la zone de recadrage (0-1, relatif à l'image). */
  cropY: number
}

/** Bornes d'un format libre : de 1:2 (portrait) à 2:1 (paysage). */
export const FREEFORM_ASPECT_MIN = 0.5
export const FREEFORM_ASPECT_MAX = 2

/** Une seule source de vérité pour le ratio utilisé par aperçu et export. */
export function getCropAspect(crop: CropState): number {
  return crop.freeformAspect ?? crop.aspect
}

export const DEFAULT_CROP: CropState = {
  aspect: 0,   // 0 = original
  rotation: 0,
  straighten: 0,
  flipH: false,
  flipV: false,
  cropX: 0.5,  // centré
  cropY: 0.5,  // centré
}

export const ASPECT_OPTIONS = [
  { id: 'original', label: 'Original', ratio: 0, icon: 'free' as const },
  { id: 'square', label: 'Carré', ratio: 1, icon: 'square' as const },
  { id: 'portrait', label: 'Portrait', ratio: 0.8, icon: 'portrait' as const },
  { id: 'landscape', label: 'Paysage', ratio: 1.91, icon: 'landscape' as const },
  { id: 'wide', label: 'Large', ratio: 16 / 9, icon: 'wide' as const },
] as const

/* ── Ajustements manuels ────────────────────────────────────────── */

export interface Adjustments {
  brightness: number   // -100..100
  contrast: number     // -100..100
  saturation: number   // -100..100
  warmth: number       // -100..100
  fade: number         // -100..100
  highlights: number   // -100..100
  shadows: number      // -100..100
  tint: number         // -100..100
  sharpen: number      // -100..100
  vignette: number     // 0..100
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  fade: 0,
  highlights: 0,
  shadows: 0,
  tint: 0,
  sharpen: 0,
  vignette: 0,
}

/* ── Filtres Instagram ──────────────────────────────────────────── */

export interface FilterDeltas {
  brightness?: number
  contrast?: number
  saturate?: number
  hue?: number
  sepia?: number
  grayscale?: number
  blur?: number
  invert?: number
}

export interface FilterDef {
  id: string
  name: string
  deltas: FilterDeltas
}

export const FILTERS: FilterDef[] = [
  { id: 'none', name: 'Original', deltas: {} },
  { id: 'clarendon', name: 'Clarendon', deltas: { brightness: 0.05, contrast: 0.2, saturate: 0.35 } },
  { id: 'gingham', name: 'Gingham', deltas: { brightness: 0.05, sepia: 0.12 } },
  { id: 'moon', name: 'Moon', deltas: { grayscale: 1, brightness: 0.08, contrast: 0.1 } },
  { id: 'lark', name: 'Lark', deltas: { saturate: 0.18, brightness: 0.1, contrast: -0.04 } },
  { id: 'reyes', name: 'Reyes', deltas: { sepia: 0.35, brightness: 0.1, contrast: -0.05 } },
  { id: 'juno', name: 'Juno', deltas: { saturate: 0.4, contrast: 0.05 } },
  { id: 'slumber', name: 'Slumber', deltas: { saturate: -0.15, brightness: 0.1, sepia: 0.2 } },
  { id: 'crema', name: 'Crema', deltas: { sepia: 0.2, contrast: -0.05, brightness: 0.03 } },
  { id: 'ludwig', name: 'Ludwig', deltas: { brightness: 0.05, saturate: -0.1, contrast: 0.05 } },
  { id: 'aden', name: 'Aden', deltas: { hue: 18, saturate: -0.18, brightness: 0.05 } },
  { id: 'inkwell', name: 'Inkwell', deltas: { grayscale: 1, contrast: 0.05 } },
  { id: 'perpetua', name: 'Perpetua', deltas: { saturate: 0.22, brightness: 0.05 } },
  { id: 'valencia', name: 'Valencia', deltas: { sepia: 0.18, contrast: 0.1, brightness: 0.04 } },
]

/* ── Effets ─────────────────────────────────────────────────────── */

export type EffectOverlay = 'grain' | 'leak' | 'prism' | 'vignette'

export interface EffectDef {
  id: string
  name: string
  deltas: FilterDeltas
  overlay?: EffectOverlay
}

export const EFFECTS: EffectDef[] = [
  { id: 'ef-none', name: 'None', deltas: {} },
  { id: 'ef-vintage', name: 'Vintage', deltas: { sepia: 0.45, contrast: 0.1, brightness: 0.05 }, overlay: 'leak' },
  { id: 'ef-noir', name: 'Noir', deltas: { grayscale: 1, contrast: 0.3 }, overlay: 'grain' },
  { id: 'ef-dream', name: 'Dream', deltas: { blur: 1.1, brightness: 0.08, saturate: 0.2 } },
  { id: 'ef-pop', name: 'Pop', deltas: { contrast: 0.35, saturate: 0.45 } },
  { id: 'ef-cool', name: 'Cool', deltas: { hue: 28, saturate: 0.18 } },
  { id: 'ef-warm', name: 'Warm', deltas: { sepia: 0.25, saturate: 0.12, hue: -8 } },
  { id: 'ef-film', name: 'Film', deltas: { contrast: 0.12, saturate: -0.05, sepia: 0.15 }, overlay: 'grain' },
  { id: 'ef-prism', name: 'Prism', deltas: { saturate: 0.2 }, overlay: 'prism' },
  { id: 'ef-invert', name: 'Invert', deltas: { invert: 1 } },
  { id: 'ef-leak', name: 'Light Leak', deltas: { brightness: 0.05, saturate: 0.1 }, overlay: 'leak' },
  { id: 'ef-mono', name: 'Mono', deltas: { grayscale: 1 }, overlay: 'grain' },
]

/* ── Overlays (texte, sticker, dessin) ──────────────────────────── */

export interface Point {
  x: number
  y: number
}

export type OverlayEl =
  | { id: string; kind: 'stroke'; points: Point[]; color: string; size: number }
  | { id: string; kind: 'text'; text: string; x: number; y: number; color: string; fontId: string; size: number }
  | { id: string; kind: 'sticker'; emoji: string; x: number; y: number; scale: number }

export const STICKERS = [
  '😀', '😍', '🔥', '❤️', '👍', '🎉', '😂', '🥺',
  '😎', '🤔', '💪', '🙌', '✨', '🌟', '💯', '🎵',
  '📸', '🎬', '✈️', '🌍', '☀️', '🌈', '🍕', '🎸',
  '🏆', '💡', '🎨', '🦋', '🌺', '⚡', '🚀', '💎',
]

/* ── Caméra Studio ─────────────────────────────────────────────── */

/** Ratio d'aspect de la caméra. */
export type AspectRatioValue = '9:16' | '1:1' | '4:5' | '16:9' | 'original'

export const ASPECT_RATIOS: { value: AspectRatioValue; label: string; ratio: number }[] = [
  { value: '9:16', label: '9:16', ratio: 9 / 16 },
  { value: '1:1', label: '1:1', ratio: 1 },
  { value: '4:5', label: '4:5', ratio: 4 / 5 },
  { value: '16:9', label: '16:9', ratio: 16 / 9 },
  { value: 'original', label: 'Original', ratio: 0 },
]

/** Vitesse de capture vidéo (appliquée au rendu FFmpeg). */
export type CaptureSpeed = '0.3' | '0.5' | '1' | '2' | '3'

export interface RecordingSegment {
  uri: string
  durationMs: number
  /** Faux quand le micro a été refusé : le fichier n'a alors aucune piste audio. */
  hasAudio?: boolean
}

export const CAPTURE_SPEEDS: { value: CaptureSpeed; label: string }[] = [
  { value: '0.3', label: '0.3x' },
  { value: '0.5', label: '0.5x' },
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '3', label: '3x' },
]

export const COLORS = [
  '#ffffff', '#000000', '#ff3b30', '#ff9500', '#ffcc00',
  '#34c758', '#0a84ff', '#bf5af2', '#ff2d92',
]

/* ── Helpers ────────────────────────────────────────────────────── */

export function getFilter(id: string): FilterDef {
  return FILTERS.find((f) => f.id === id) ?? FILTERS[0]
}

export function getEffect(id: string): EffectDef {
  return EFFECTS.find((e) => e.id === id) ?? EFFECTS[0]
}

/* ── Édition vidéo ──────────────────────────────────────────────── */

export interface VideoEdit {
  /** Début du trim, en millisecondes. */
  trimStart: number
  /** Fin du trim, en millisecondes. 0 = jusqu'à la fin. */
  trimEnd: number
  muted: boolean
  /** Instant de la vignette de couverture, en millisecondes. */
  coverTime: number
  /** Facteur de vitesse de lecture. 1 = temps réel, 2 = deux fois plus rapide. */
  speed: number
}

export const DEFAULT_VIDEO_EDIT: VideoEdit = {
  trimStart: 0,
  trimEnd: 0,
  muted: false,
  coverTime: 1000,
  speed: 1,
}
