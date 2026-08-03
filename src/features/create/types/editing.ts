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
  /** Rotation en degrés (inclut le straighten -45..45 et les 90° increments). */
  rotation: number
  flipH: boolean
  flipV: boolean
}

export const DEFAULT_CROP: CropState = {
  aspect: 0,   // 0 = original
  rotation: 0,
  flipH: false,
  flipV: false,
}

export const ASPECT_OPTIONS = [
  { id: 'original', label: 'Original', ratio: 0, icon: 'free' as const },
  { id: 'square', label: '1:1', ratio: 1, icon: 'square' as const },
  { id: 'portrait', label: '4:5', ratio: 0.8, icon: 'portrait' as const },
  { id: 'landscape', label: '1.91:1', ratio: 1.91, icon: 'landscape' as const },
  { id: 'wide', label: '16:9', ratio: 16 / 9, icon: 'wide' as const },
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
