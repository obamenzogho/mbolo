/* src/features/news/theme/postTokens.ts
   Source unique de vérité visuelle du fil Actus.
   Aucune valeur littérale (#hex, px, poids de police) ne doit apparaître
   ailleurs dans le module news. Si une valeur manque ici, on l'ajoute ici. */

import type { TextStyle } from 'react-native'
import { colors as appColors } from '@/lib/theme'

export const postColors = {
  /** Fond du fil, visible entre les cartes */
  canvas: '#08090A',
  /** Fond d'une carte */
  surface: '#111214',
  /** Surface secondaire : avatar vide, placeholder média, pastille */
  surfaceRaised: '#1A1D20',
  /** Trait de séparation intra-carte */
  hairline: '#2B2E33',

  textPrimary: '#F2F3F4',
  textSecondary: '#A6ABB0',
  textTertiary: '#7B8187',

  accent: appColors.primary,
  accentSoft: 'rgba(0, 200, 83, 0.12)',

  /** Voile sur média (bouton play, compteur +N) */
  scrim: 'rgba(8, 9, 10, 0.72)',
  scrimLight: 'rgba(8, 9, 10, 0.18)',
  scrimHeavy: 'rgba(8, 9, 10, 0.58)',

  mediaPlaceholder: '#15181B',
} as const

/* Rythme volontairement irrégulier : l'en-tête respire plus que la barre
   d'actions, le média colle aux bords. Un padding uniforme aplatit la carte. */
export const postSpacing = {
  gutter: 14,
  headerTop: 13,
  headerBottom: 9,
  blockBottom: 12,
  inlineGap: 6,
  rowGap: 10,
  /** Épaisseur du fond entre deux cartes */
  cardGap: 8,
} as const

export const postRadius = {
  avatar: 21,
  pill: 18,
  overlay: 29,
} as const

export const postType = {
  author: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  authorSuffix: { fontSize: 15, fontWeight: '400' },
  meta: { fontSize: 12, fontWeight: '500' },
  body: { fontSize: 15, lineHeight: 21 },
  /** Post texte seul sur fond dégradé */
  bodyHero: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  stat: { fontSize: 12, fontWeight: '500' },
  action: { fontSize: 11.5, fontWeight: '600' },
  link: { fontSize: 14, fontWeight: '600' },
} satisfies Record<string, TextStyle>

export const postMotion = {
  /** Opacité d'un élément pressé */
  pressedOpacity: 0.62,
  /** Fondu des images distantes (expo-image) */
  imageTransition: 260,
  /** Ressort du bouton de réaction */
  spring: { friction: 5, tension: 240, useNativeDriver: true },
} as const

/** Largeur max du contenu : évite les médias étirés sur tablette / web */
export const POST_MAX_WIDTH = 720

/** Nombre de caractères affichés avant « Voir plus » */
export const POST_TEXT_LIMIT = 280

/** Gouttière de la grille média */
export const MEDIA_GAP = 2

/** Nombre max de vignettes avant l'overlay +N */
export const MEDIA_VISIBLE_MAX = 4

export const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const
