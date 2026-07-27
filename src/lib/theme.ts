/* ============================================================
   MBolo Design Tokens
   Système de design unifié. Toutes les valeurs visuelles du
   projet doivent passer par ces tokens — pas de hardcoded values.
   ============================================================ */

// ── Couleurs de marque (Gabon) ────────────────────────────
export const colors = {
  // Marque
  primary: '#00C853',
  primaryDark: '#009A44',
  secondary: '#3A75C4',
  accent: '#FCD116',

  // Surfaces (hiérarchie de profondeur)
  background: '#0A0C10',
  surface: '#141619',
  surfaceElevated: '#1C1F24',
  surfaceHighlight: '#252830',

  // Texte (hiérarchie de lisibilité)
  textPrimary: '#F0F0F0',
  textSecondary: '#8A8D93',
  textMuted: '#5A5D63',

  // Bordures & séparateurs
  border: '#2A2D33',
  borderLight: '#1E2025',

  // États
  error: '#F85149',
  success: '#00C853', // = primary pour cohérence
  warning: '#FCD116', // = accent

  // Actions feed
  like: '#FFD700',    // jaune doré pour les likes
  save: '#FFD700',    // jaune doré pour les sauvegardes
  progress: '#00C853',

  // Utilitaires
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.7)',

  // Opacités réutilisables
  textOnMedia: 'rgba(255,255,255,0.85)',
  textFaint: '#5A5D63', // alias de textMuted (rétro-compat)
  hairline: 'rgba(255,255,255,0.1)',
} as const

// ── Typographie ───────────────────────────────────────────
export const typography = {
  // Tailles de police
  size: {
    xs: 11,    // badges, labels très petits
    sm: 13,    // meta, captions
    base: 15,  // body text, labels principaux
    lg: 17,    // titres de section, noms
    xl: 20,    // titres secondaires
    '2xl': 24, // titres de page
    '3xl': 30, // display
  },
  // Poids de police
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  // Interlignes
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const

// ── Espacement (grille 4px) ──────────────────────────────
export const spacing = {
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const

// ── Rayons de bordure ─────────────────────────────────────
export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  pill: 9999,
  circle: 9999,
} as const

// ── Ombres / Élévation ────────────────────────────────────
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
} as const

// ── Accessibilité ─────────────────────────────────────────
export const a11y = {
  minTouchTarget: 44,
  focusRingWidth: 2,
  focusRingColor: colors.primary,
} as const
