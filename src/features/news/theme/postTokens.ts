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

  /** Texte/icônes sur média ou dégradé (bouton play, durée, +N) */
  onMedia: '#FFFFFF',

  accent: appColors.primary,
  accentSoft: 'rgba(0, 200, 83, 0.12)',

  /** J'aime : cœur jaune doré, identique au feed vidéo */
  like: appColors.like,
  /** Sauvegarde (bookmark), identique au feed vidéo */
  save: appColors.save,

  /** Badge « compte vérifié » */
  verified: '#3B82F6',

  /** Fond des boutons d'icône ronds (options, ...) */
  buttonDark: '#000000',

  /** Voile sur média (bouton play, compteur +N) */
  scrim: 'rgba(8, 9, 10, 0.72)',
  scrimLight: 'rgba(8, 9, 10, 0.18)',
  scrimHeavy: 'rgba(8, 9, 10, 0.58)',

  mediaPlaceholder: '#15181B',

  /* ── Composeur ──────────────────────────────────────────
     Le composeur est une surface d'édition, pas de lecture :
     il lui faut des états de saisie (champ, focus, sélection)
     que la carte de lecture n'a jamais besoin d'exprimer. */

  /** Fond d'un champ de saisie (titre d'article, option de sondage) */
  inputSurface: '#161A1D',
  /** Bordure d'un champ au repos */
  inputBorder: '#2B2E33',
  /** Bordure d'un champ actif */
  inputBorderFocus: appColors.primary,
  /** Zone d'ajout en pointillés (couverture d'article, choix de vidéo) */
  dropzoneBorder: '#33383D',
  /** Pastille de type de publication non sélectionnée */
  chipSurface: '#1A1D20',

  /* Couleurs des entrées de la feuille d'options. Facebook associe une
     teinte à chaque action : elle sert de repère mémoriel, l'utilisateur
     vise la couleur avant de lire le libellé. */
  optionPhoto: '#45BD62',
  optionVideo: '#F3425F',
  optionPoll: '#2D9CDB',
  optionArticle: '#9B6DFF',
  optionLocation: '#EB5757',
  optionMood: '#F7B928',

  /** Barre de progression de publication */
  progressTrack: '#1F2327',

  /* ── Galerie et caméra ──────────────────────────────────
     La grille et l'aperçu caméra sont des surfaces plein écran :
     elles vivent sur du noir franc, pas sur le fond du fil, pour que
     l'œil aille au média et non au châssis. */

  /** Fond d'une cellule de la grille avant chargement de la vignette */
  galleryCell: '#15181B',
  /** Pastille numérotée d'un média sélectionné */
  selectionBadge: appColors.primary,
  /** Trait sous l'onglet de mode actif */
  tabIndicator: '#F2F3F4',
  /** Fond de l'aperçu caméra et des barres qui le surplombent */
  cameraBackdrop: '#000000',
  /** Bouton d'enregistrement pendant la capture vidéo */
  recordActive: '#FF3B30',
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
  /** Champ de saisie, carte d'option, zone média du composeur */
  input: 12,
  /** Pastille de sélection de type */
  chip: 20,
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

  /* Composeur */
  /** Saisie principale « Quoi de neuf ? » */
  composeInput: { fontSize: 17, lineHeight: 24 },
  /** Titre d'article */
  composeTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  /** Libellé d'une entrée de la feuille d'options */
  composeOption: { fontSize: 15, fontWeight: '500' },
  /** Intitulé de section (« Ajouter à ta publication ») */
  composeSection: { fontSize: 13, fontWeight: '600' },
  /** Compteur de caractères */
  composeCounter: { fontSize: 12, fontWeight: '500' },
  /** Emoji d'humeur dans la grille de sélection */
  composeEmoji: { fontSize: 24 },
  /** Libellé d'un onglet de mode (Galerie, Appareil photo, ...) */
  composeTab: { fontSize: 13, fontWeight: '600' },
  /** Durée d'une vidéo, en incrustation sur la vignette */
  mediaDuration: { fontSize: 11, fontWeight: '600' },
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

/* ── Limites de saisie du composeur ──────────────────────
   Le texte sur fond dégradé est plus court : au-delà, la police
   héroïque devient illisible et l'image perd son impact. */
export const COMPOSE_LIMITS = {
  text: 3000,
  backgroundText: 280,
  articleTitle: 200,
  articleBody: 5000,
  pollQuestion: 200,
  pollOption: 80,
  /** Seuil d'affichage du compteur : inutile de le montrer trop tôt */
  counterVisibleRatio: 0.8,
} as const

/** Nombre max de médias dans une publication */
export const COMPOSE_MAX_MEDIA = 8

/** Bornes du nombre d'options d'un sondage */
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 4

/* ── Grille de galerie ───────────────────────────────────
   Trois colonnes et une gouttière de 2 px : au-delà, les vignettes
   deviennent trop petites pour reconnaître une photo ; en deçà, la
   grille perd sa densité de contact-sheet. */
export const GALLERY_COLUMNS = 3
export const GALLERY_GAP = 2

/** Durées d'enregistrement proposées, en secondes */
export const CAMERA_DURATIONS = [15, 30, 60] as const
