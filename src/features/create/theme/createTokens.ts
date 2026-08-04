/* src/features/create/theme/createTokens.ts

   Palette et typo du nouveau flux de création, portées du prototype
   createPost-instagram (design Instagram : fond noir, texte blanc, gris
   neutres ; écran légende clair). */

import { colors } from '@/lib/theme'

/** Écran de choix du média : sombre, les photos règnent. */
export const createColors = {
  canvas: '#000000',
  /** neutral-900 : fond de l'aperçu vide. */
  surface: '#171717',
  /** neutral-800 : pastilles, cellules pressées. */
  surfaceDim: '#262626',
  hairline: 'rgba(255, 255, 255, 0.12)',
  textPrimary: '#ffffff',
  /** neutral-400 : libellés secondaires. */
  textSecondary: '#a3a3a3',
  /** neutral-500 : placeholders. */
  textTertiary: '#737373',
  /** Accent de sélection : le vert Mbolo. */
  accent: colors.primary,
  danger: '#ff3b30',
} as const

/** Caméra studio : overlays et chips posés sur le flux vidéo. */
export const cameraColors = {
  /** Voile des boutons overlay (retour, aperçu). */
  overlayScrim: 'rgba(0, 0, 0, 0.4)',
  /** Fond d'une pastille d'outil au repos. */
  chipIdle: 'rgba(0, 0, 0, 0.35)',
  /** Fond d'une pastille d'outil sélectionnée. */
  chipActive: 'rgba(255, 255, 255, 0.25)',
  /** Texte/icône d'une pastille au repos. */
  chipContentIdle: 'rgba(255, 255, 255, 0.6)',
  /** Texte/icône d'une pastille sélectionnée. */
  chipContentActive: '#ffffff',
  /** Séparateur entre groupes de pastilles. */
  chipSeparator: 'rgba(255, 255, 255, 0.2)',
  /** Lignes de la grille de composition. */
  gridLine: 'rgba(255, 255, 255, 0.2)',
  /** Masque hors cadre du ratio choisi. */
  ratioMask: 'rgba(0, 0, 0, 0.6)',
  onMedia: '#ffffff',
} as const

/** Opacité appliquée à un élément pressé du flux de création. */
export const createMotion = { pressedOpacity: 0.6 } as const

/** Écran de légende : clair, comme le prototype. */
export const captionColors = {
  canvas: '#ffffff',
  hairline: 'rgba(17, 17, 17, 0.1)',
  textPrimary: '#111111',
  textSecondary: '#737373',
  danger: '#ff3b30',
  surfaceRaised: '#f5f5f5',
} as const

export const createType = {
  /** Titre de l'en-tête (Nouveau post). */
  title: { fontSize: 17, fontWeight: '700' },
  /** Libellé des pastilles de création (Texte, Caméra…). */
  createLabel: { fontSize: 11, fontWeight: '500' },
  /** Placeholder de l'aperçu vide. */
  placeholder: { fontSize: 13 },
  /** Légende. */
  caption: { fontSize: 15, lineHeight: 21 },
  /** Libellé des lignes de réglages. */
  row: { fontSize: 15, fontWeight: '400' },
} as const
