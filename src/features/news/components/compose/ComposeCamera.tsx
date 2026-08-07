/* src/features/news/components/compose/ComposeCamera.tsx

   Caméra studio (style TikTok).

   Fonctionnalités :
   - Déclencheur Instagram : tap = photo, maintenir = vidéo (pas de
     sélecteur photo/vidéo ; la minuterie passe en mains-libres)
   - Flash (off/on/auto en photo, torche en vidéo — un seul bouton contextuel)
   - Switch caméra avant/arrière
   - Timer (none, 3s, 10s)
   - Zoom pince (PanResponder, 0..1 du zoom max de l'appareil)
   - Grid of thirds
   - Ratio d'aspect (9:16, 1:1, 4:5, 16:9, Original)
   - Vitesse de capture vidéo (0.3x → 3x)
   - Pause/reprise vidéo
   - Rail d'outils vertical à gauche (ratio, vitesse, durée, timer, grid,
     qualité, stab) — disposition Instagram

   Le composant ne navigue pas : il remonte le média par `onCapture` et
   laisse l'orchestrateur décider de la suite. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, Platform } from 'react-native'
import type { GestureResponderEvent, NativeTouchEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions, useMicrophonePermissions, type FocusMode } from 'expo-camera'
import { useIsFocused } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { captureException } from '@/lib/sentry'
import {
  HIT_SLOP,
  postColors,
  postMotion,
  postRadius,
  postSpacing,
  postType,
} from '../../theme/postTokens'
import type { SelectedMedia } from '../../hooks/useComposeState'
import type {
  AspectRatioValue,
  CaptureSpeed,
  FlashMode,
} from '@/features/create/types/editing'
import {
  ASPECT_RATIOS,
  CAPTURE_SPEEDS,
  DEFAULT_VIDEO_EDIT,
  FILTERS,
  getFilter,
  nextFlashMode,
  VIDEO_QUALITY_OPTIONS,
  ZOOM_PRESETS,
} from '@/features/create/types/editing'
import { cameraColors } from '@/features/create/theme/createTokens'
import { CameraOverlay } from '@/features/create/components/camera/CameraOverlay'
import { CameraSideRail, type ToolSheetId } from '@/features/create/components/camera/CameraSideRail'
import { SegmentedProgressBar } from '@/features/create/components/camera/SegmentedProgressBar'
import { FocusIndicator, type FocusPoint } from '@/features/create/components/camera/FocusIndicator'
import { useSegmentedRecording } from '@/features/create/hooks/useSegmentedRecording'
import { useCameraPreferences } from '@/features/create/hooks/useCameraPreferences'
import { useLatestGalleryAsset } from '@/features/create/hooks/useLatestGalleryAsset'
import { concatSegments } from '@/features/create/utils/concatSegments'
import { saveMediaToLibrary } from '@/features/create/utils/cameraRoll'
import MboloBottomSheet from '@/components/MboloBottomSheet'
import { ProgressRing } from '@/components/ui/ProgressRing'
import type BottomSheet from '@gorhom/bottom-sheet'

type CameraMode = 'picture' | 'video'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Durée compacte pour les options du rail : 15s, 30s, 1min, 3min. */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  return `${m}min`
}

/* Options des panneaux du rail (minuterie, durée max). */
const TIMER_OPTIONS = [0, 3, 10] as const
const DURATION_OPTIONS = [15, 30, 60, 180, 600]
/** Compromis Instagram : au-delà, le poids monte sans gain visible. */
const PHOTO_QUALITY = 0.8
/* `zoom` d'expo-camera est un pourcentage du zoom max de l'appareil (0..1),
   pas un facteur optique. */
const MIN_ZOOM = 0
const MAX_ZOOM = 1
/* Écart de doigts (px) au-delà duquel on couvre toute la plage de zoom.
   Plus la valeur est haute, plus le geste est fin. */
const PINCH_RANGE_PX = 400
/* Déplacement horizontal minimal (px) d'un glissement 1 doigt pour être
   traité comme un swipe (bascule d'onglet), pas comme un tap de focus. */
const SWIPE_THRESHOLD_PX = 40
/* Durée de verrouillage du focus après un tap, avant retour à l'autofocus
   continu (comportement Instagram). */
const FOCUS_LOCK_MS = 3000
/* Seuil en dessous duquel un appui sur le déclencheur est traité comme une
   photo (tap) ; au-delà, c'est un enregistrement vidéo (comportement
   Instagram : tap = photo, maintenir = vidéo). */
const HOLD_THRESHOLD_MS = 170
/* Morph du déclencheur (clone Instagram) : le disque blanc (58 px) se
   transforme en petit carré rouge arrondi (26 px) pendant l'enregistrement.
   Ratio d'échelle du morph. */
const SHUTTER_STOP_RATIO = 26 / 58
/* Durée de la transition disque → carré (comportement Instagram : douce,
   pas un basculement brutal). */
const SHUTTER_MORPH_MS = 220
/* Minuteur Instagram : l'anneau de progression (`ProgressRing`) remplace la
   bordure du déclencheur dès qu'un enregistrement existe. Dimensions calées
   sur `shutterOuter` (74 px, bordure 4 px) pour un tour parfaitement aligné. */
const SHUTTER_OUTER_SIZE = 74
const SHUTTER_RING_STROKE = 4
/* Dernières secondes avant la durée max : l'anneau passe au rouge (alerte
   visuelle, comme Instagram). */
const RECORD_END_WARNING_MS = 3000
/* Durée d'animation du trait vers chaque nouvelle cible (un tick par
   seconde) : suffisante pour un déplacement fluide par paliers. */
const RING_ANIMATION_MS = 350
/* Fenêtre de détection du double-tap : deux appuis plus espacés sont deux
   taps simples (anneau de focus) ; plus rapprochés = double-tap (reset
   zoom 1x, comportement Instagram). */
const DOUBLE_TAP_MS = 300

function touchDistance(touches: NativeTouchEvent[]): number {
  const [a, b] = touches
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)
}

interface ComposeCameraProps {
  /** Capture unitaire : une photo ou une vidéo. */
  onCapture: (media: SelectedMedia) => void
  /* Mode de capture imposé par l'onglet parent : 'picture' → photos
     uniquement, 'video' → enregistrement vidéo direct. Le sélecteur de
     ratio/vitesse/filtres s'adapte au type. Par défaut 'picture'. */
  initialMode?: CameraMode
  /* Décalage horizontal du topBar pour laisser de la place à un bouton
     overlay (ex. bouton retour dans SelectScreen). */
  topBarInset?: number
  /* Décalage vertical additionnel du topBar (pour passer sous un overlay
     absolu, ex. barre d'onglets en mode caméra). */
  topContentOffset?: number
  /** Ouvre la galerie depuis la vignette sous le déclencheur (clone
      Instagram). Absent = vignette non interactive. */
  onOpenGallery?: () => void
  /* ── Ajout (reproduction caméra Reel Instagram) ──────────────────
     Son : la musique choisie par l'utilisateur (id SoundRecord), remontée
     par onOpenSound/onClearSound vers l'orchestrateur du flux (app/create)
     qui détient le SoundPickerSheet. */
  soundId?: string | null
  onOpenSound?: () => void
  onClearSound?: () => void
  /* ── Swipe horizontal (clone caméra Reel Instagram) ──────────────
     Le `pinchResponder` revendique tous les départs de touche (tap/pinch),
     donc un swipe sur le corps caméra n'atteint jamais la racine. On
     capte ici le glissement 1 doigt horizontal et on le remonte. */
  onHorizontalSwipe?: (direction: 'left' | 'right') => void
}

export function ComposeCamera({
  onCapture,
  initialMode = 'picture',
  topBarInset,
  topContentOffset = 0,
  onOpenGallery,
  soundId,
  onOpenSound,
  onClearSound,
  onHorizontalSwipe,
}: ComposeCameraProps) {
  const { t } = useI18n()
  const isFocused = useIsFocused()
  const insets = useSafeAreaInsets()
  const cameraRef = useRef<CameraView>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /* Geste du déclencheur (Instagram : tap = photo, maintenir = vidéo).
     - `holdThresholdRef` : minuteur d'attente avant de démarrer une vidéo.
     - `didHoldFireRef` : vrai si le seuil « maintenir » a été franchi (donc
       on est en vidéo), pour décider au relâché s'il faut arrêter ou prendre
       une photo.
     - `holdIntentRef` : signal posé au franchissement du seuil ; il rend
       l'intention vidéo visible depuis `startRecording` (qui la ré-évalue
       juste avant `recordAsync`) — plus aucun `useEffect` dans ce pipeline. */
  const holdThresholdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didHoldFireRef = useRef(false)
  const holdIntentRef = useRef(false)

  const [permission, requestPermission] = useCameraPermissions()
  const [micPermission, requestMicPermission] = useMicrophonePermissions()
  /* Mode du capteur expo-camera : 'picture' pour `takePictureAsync`,
     'video' pour `recordAsync`. Le mode bascule DANS le geste du
     déclencheur (Instagram : tap = photo, maintenir = vidéo). */
  const [cameraMode, setCameraMode] = useState<CameraMode>(initialMode)
  /* Démarrage d'enregistrement en cours d'attente (caméra en cours de
     reconfiguration après la bascule picture → video). Pendant ce temps,
     le relâché ne doit PAS repasser le mode en 'picture' (sinon le
     `recordAsync` qui suit échouerait). */
  const startPendingRef = useRef(false)
  const [facing, setFacing] = useState<'back' | 'front'>('back')
  const [flash, setFlash] = useState<FlashMode>('off')
  const [maxDuration, setMaxDuration] = useState<number>(30)
  const [timerDelay, setTimerDelay] = useState<0 | 3 | 10>(0)
  const [countdown, setCountdown] = useState(0)
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* Préférences persistées (grille, miroir, qualité, stab, pellicule). */
  const { preferences, updatePreferences } = useCameraPreferences()

  /* Vignette galerie sous le déclencheur (clone Instagram) : dernière
     prise de la pellicule, rafraîchie après chaque capture. */
  const { latest: latestGalleryAsset, available: galleryThumbAvailable, refresh: refreshGalleryThumb } =
    useLatestGalleryAsset()

  const {
    segments,
    totalDurationMs,
    remainingDurationMs,
    canRecord,
    addSegment,
    removeLastSegment,
    reset: resetSegments,
  } = useSegmentedRecording({ maxDurationMs: maxDuration * 1000 })

  /* ── Nouvel état caméra studio ─────────────────────────────────── */
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>('9:16')
  const [captureSpeed, setCaptureSpeed] = useState<CaptureSpeed>('1')
  const [zoom, setZoom] = useState(MIN_ZOOM)
  /* Torche (lumière continue) : exposée par le bouton flash unique en mode
     vidéo (comportement Instagram), indépendante du flash photo.
     Persistance locale (pas de préférence sauvegardée). */
  const [enableTorch, setEnableTorch] = useState(false)
  /* Panneau d'options actif du rail (pattern Instagram) : l'icône ouvre un
     sheet bas listant les choix. `null` = aucun panneau ouvert. */
  const [toolSheet, setToolSheet] = useState<ToolSheetId | null>(null)
  const toolSheetRef = useRef<BottomSheet>(null)
/* Panneau « Paramètres » (engrenage top bar, reproduction Instagram).
     Visible en photo ET en vidéo. */
  const settingsSheetRef = useRef<BottomSheet>(null)
  /* Panneau « Filtres » : liste des FILTERS (Original + 23) du flux de
     création, appliquée à la prise. Aperçu temps réel impossible avec
     expo-camera : le filtre est rendu côté destination (éditeur/rendu). */
  const filtersSheetRef = useRef<BottomSheet>(null)
  const [selectedFilterId, setSelectedFilterId] = useState<string>('none')
  /* Point de mise au point au tap. `null` = pas d'anneau affiché. */
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null)
  /* iOS : autofocus 'on' force un re-focus au prochain tap. */
  const [autofocus, setAutofocus] = useState<FocusMode>('off')

  /* ── Pinch-to-zoom ────────────────────────────────────────────── */
  /* `PanResponder` plutôt que `react-native-gesture-handler` : envelopper
     `CameraView` dans un `GestureDetector` fait planter l'app sous Expo Go.
     La prop `isPinchToZoomEnabled` d'expo-camera 17 n'existe que sur les
     options de scan de code-barres, pas sur `CameraView`. */
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null)
  const zoomRef = useRef(MIN_ZOOM)
  /* Origine du glissement 1 doigt : distingue un tap (immobile) d'un
     swipe horizontal (déplacement). Reposée à chaque nouveau geste. */
  const gestureStartRef = useRef<{ pageX: number; pageY: number } | null>(null)
  /* Horodatage du dernier tap simple : permet de distinguer le double-tap
     (reset zoom 1x, comme Instagram) du tap simple (anneau de focus). */
  const lastTapTimeRef = useRef<number | null>(null)

  /* ── Tap feedback (anneau) ────────────────────────────────────── */  /* expo-camera v17 n'expose PAS d'API de mise au point par point
     (contrairement à VisionCamera). Le tap affiche un anneau visuel +
     une haptique : un simple feedback de geste, comme TikTok/Instagram,
     pas un vrai tap-to-focus. Sur iOS, `autofocus='on'` re-déclenche au
     moins un cycle d'autofocus global pendant FOCUS_LOCK_MS avant retour
     à l'autofocus continu. */
  const autofocusResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Applique un niveau de zoom (double-tap reset, chips de preset, pince).
     Centralise l'écriture de `zoomRef` pour que le pinch reparte toujours
     de la dernière valeur connue. */
  const applyZoom = useCallback((nextZoom: number) => {
    zoomRef.current = nextZoom
    setZoom(nextZoom)
  }, [])

  useEffect(() => {
    return () => {
      if (autofocusResetRef.current) clearTimeout(autofocusResetRef.current)
    }
  }, [])

  const handleTapFeedback = useCallback((locationX: number, locationY: number) => {
    setFocusPoint({ x: locationX, y: locationY })
    setAutofocus('on')
    /* Retour à l'autofocus continu après le délai de verrouillage. */
    if (autofocusResetRef.current) clearTimeout(autofocusResetRef.current)
    autofocusResetRef.current = setTimeout(() => setAutofocus('off'), FOCUS_LOCK_MS)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }, [])

  /* `PanResponder` plutôt que `react-native-gesture-handler` : envelopper
     `CameraView` dans un `GestureDetector` fait planter l'app sous Expo Go.
     La prop `isPinchToZoomEnabled` d'expo-camera 17 n'existe que sur les
     options de scan de code-barres, pas sur `CameraView`.
     Le capteur gère deux gestes :
     - 1 doigt → anneau de feedback visuel + haptique
     - 2 doigts → pinch-to-zoom (0..1 du zoom max)
     `useMemo` : `PanResponder.create` est une instance stable, recréée
     seulement si `handleTapFeedback` change (jamais — deps vides). */
  /* Le React Compiler n'a pas de helper natif pour PanResponder.create : les
     callbacks captent inévitablement des refs (pinchStartRef, zoomRef via
     handleTapFeedback). `useMemo` garantit quand même une création unique —
     pattern standard RN — les deux avertissements du compiler sont des
     false-positivos pour PanResponder (issue facebook/react#29435). */
  /* eslint-disable react-hooks/preserve-manual-memoization, react-hooks/refs, react-hooks/purity -- bloc ci-dessous : PanResponder.create est intrinsèquement une instance immuable ; les callbacks captent inévitablement des refs (pinchStartRef, zoomRef via handleTapFeedback) et lisent `Date.now()` (double-tap) — ce sont des event handlers, pas du render. Le React Compiler false-positive pour PanResponder (issue facebook/react#29435) */
  const pinchResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event: GestureResponderEvent) =>
          event.nativeEvent.touches.length > 0,
        onMoveShouldSetPanResponder: (event: GestureResponderEvent) =>
          event.nativeEvent.touches.length === 2,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          const { touches } = event.nativeEvent
          /* Le grant arrive avec le 1er doigt : on affiche l'anneau.
             Le pinch, lui, démarre quand le 2e doigt arrive (move). */
          if (touches.length === 1) {
            gestureStartRef.current = {
              pageX: touches[0].pageX,
              pageY: touches[0].pageY,
            }
            const now = Date.now()
            const isDoubleTap =
              lastTapTimeRef.current != null &&
              now - lastTapTimeRef.current <= DOUBLE_TAP_MS
            lastTapTimeRef.current = isDoubleTap ? null : now
            if (isDoubleTap) {
              /* Double-tap : reset zoom 1x (comportement Instagram). Le
                 geste est consommé par le zoom, pas d'anneau de focus. */
              applyZoom(MIN_ZOOM)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              return
            }
            handleTapFeedback(event.nativeEvent.locationX, event.nativeEvent.locationY)
          }
        },
        onPanResponderMove: (event: GestureResponderEvent) => {
          const { touches } = event.nativeEvent
          if (touches.length === 2) {
            /* Premier mouvement à 2 doigts : le grant a eu lieu avec 1
               doigt, la distance de référence ne peut être calculée qu'ici. */
            if (pinchStartRef.current == null) {
              pinchStartRef.current = { distance: touchDistance(touches), zoom: zoomRef.current }
            }
            const start = pinchStartRef.current
            const delta = (touchDistance(touches) - start.distance) / PINCH_RANGE_PX
            const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom + delta))
            zoomRef.current = next
            setZoom(next)
          } else if (touches.length === 1) {
            /* On est revenu à 1 doigt (doigt levé) : le prochain pinch
               repartira d'une distance de référence fraîche. */
            pinchStartRef.current = null
          }
        },
        onPanResponderRelease: (event: GestureResponderEvent) => {
          pinchStartRef.current = null
          const { touches } = event.nativeEvent
          const start = gestureStartRef.current
          gestureStartRef.current = null
          if (!onHorizontalSwipe || !start || touches.length !== 1) return
          const dx = touches[0].pageX - start.pageX
          const dy = touches[0].pageY - start.pageY
          if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dy) > Math.abs(dx)) return
          onHorizontalSwipe(dx < 0 ? 'left' : 'right')
        },
        onPanResponderTerminate: () => {
          pinchStartRef.current = null
          gestureStartRef.current = null
        },
      }),
    [handleTapFeedback, applyZoom, onHorizontalSwipe],
  )
  /* eslint-enable react-hooks/preserve-manual-memoization, react-hooks/refs */

  /* Le zoom est propre à l'objectif : le garder au retournement donnerait
     un cadrage arbitraire sur la caméra frontale. La torche n'équipe pas
     les capteurs front : on la coupe en basculant. */
  const handleFlipCamera = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'))
    zoomRef.current = MIN_ZOOM
    setZoom(MIN_ZOOM)
    setEnableTorch(false)
  }, [])

  /* ── Timer enregistrement ─────────────────────────────────────── */
  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = null
    setCountdown(0)
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
      if (holdThresholdRef.current) clearTimeout(holdThresholdRef.current)
    }
  }, [])

  /* ── Stop recording ───────────────────────────────────────────── */
  const stopRecording = useCallback(() => {
    if (!cameraRef.current || !recording) return
    cameraRef.current.stopRecording()
  }, [recording])

  useEffect(() => {
    if (!isFocused && recording) stopRecording()
  }, [isFocused, recording, stopRecording])

/* ── Start recording ──────────────────────────────────────────── */
  /* Morph du déclencheur (clone Instagram) : 0 = repos (disque blanc),
     1 = enregistrement (carré rouge + anneau rouge). Le core RN `Animated`
     (pattern OrbitLoader/ConnectionBanner) est le seul API d'animation
     toléré par le React Compiler d'Expo SDK 54 sur ce fichier : les shared
     values Reanimated écrites depuis des callbacks y sont rejetées
     (« value previously passed as an argument to a hook »). Le scale et le
     borderRadius s'animent (58 px → 26 px, coins 29 → 6) ; la couleur bascule
     avec `morphActive` (le core RN n'interpole pas les couleurs). */
  const [morphActive, setMorphActive] = useState(false)
  /* Animated.Value porté par un state (pattern ProgressBar) : le compiler
     l'identifie, alors qu'un `useRef(...).current` lu pendant le render est
     interdit (« Cannot access refs during render »). */
  const [morph] = useState(() => new Animated.Value(0))
  const animateMorph = useCallback((to: 0 | 1) => {
    setMorphActive(to === 1)
    Animated.timing(morph, {
      toValue: to,
      duration: SHUTTER_MORPH_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [morph])

  /* Minuteur Instagram : anneau de progression autour du déclencheur. La
     progression combine les segments déjà enregistrés et le segment courant
     (elapsed) ; le trait remplace la bordure statique dès qu'un
     enregistrement existe, et passe au rouge dans les dernières secondes. */
  const maxRecordingMs = maxDuration * 1000
  const recordedMs = totalDurationMs + (recording ? elapsed * 1000 : 0)
  const ringProgress = Math.min(1, recordedMs / maxRecordingMs)
  const ringVisible = recording || totalDurationMs > 0
  const ringColor =
    ringVisible && maxRecordingMs - recordedMs <= RECORD_END_WARNING_MS
      ? postColors.recordActive
      : postColors.onMedia
  /* La bordure du déclencheur est remplacée par l'anneau de progression
     (même position, même épaisseur : aucun décalage visuel). */
  const shutterRingStyle = ringVisible
    ? { borderColor: 'transparent' }
    : { borderColor: postColors.onMedia }

  /* Le disque blanc se mue en carré rouge arrondi : coins et échelle
     interpolés ensemble (58 px → 26 px), comme Instagram. */
  const shutterMorphStyle = {
    backgroundColor: morphActive ? postColors.recordActive : postColors.onMedia,
    borderRadius: morph.interpolate({
      inputRange: [0, 1],
      outputRange: [29, 6],
    }),
    transform: [
      {
        scale: morph.interpolate({
          inputRange: [0, 1],
          outputRange: [1, SHUTTER_STOP_RATIO],
        }),
      },
    ],
  }

  /* `trigger` distingue le hold (le relâché annule l'intention) du
     mains-libres (minuterie, où l'intention ne dépend pas du geste). */
  const startRecording = useCallback(async (trigger: 'hold' | 'timer') => {
    if (recording || !canRecord) return

    /* Chaque sortie anticipée doit refermer le pending et revenir en mode
       'picture' : l'intention vidéo n'a pas abouti, on rend le déclencheur
       à son état photo (morph compris). */
    const abort = () => {
      startPendingRef.current = false
      animateMorph(0)
      setCameraMode(initialMode)
    }

    /* Pendant la bascule picture → video, expo-camera peut re-monte la vue
       native : `cameraRef.current` devient null transitoirement, et
       `recordAsync` exige un capteur reconfiguré. On attend la caméra
       (borné) puis on laisse le retry absorber la reconfiguration. */
    startPendingRef.current = true
    let camera = cameraRef.current
    for (let wait = 0; !camera && wait < 10; wait++) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      camera = cameraRef.current
    }
    if (!camera) {
      captureException(new Error('Camera unavailable after mode switch'), {
        context: 'news.compose.record',
      })
      abort()
      return
    }

    let audioGranted = micPermission?.granted ?? false
    if (!audioGranted) {
      const result = await requestMicPermission()
      if (!result.granted) {
        Alert.alert(
          t.news.compose.errorTitle,
          t.news.compose.errorMicrophoneDenied,
        )
        abort()
        return
      }
      audioGranted = true
    }

    /* Le dialog de permission a pu durer plus longtemps que le maintien :
       si le doigt a été relâché entre-temps, l'intention vidéo est morte. */
    if (trigger === 'hold' && !didHoldFireRef.current) {
      abort()
      return
    }

    /* Laisse le CameraView re-rendre en mode 'video' (le setState est
       asynchrone) avant le premier recordAsync. */
    await new Promise((resolve) => setTimeout(resolve, 150))

    /* Ré-évaluation juste avant de capturer : le relâchement pendant la
       fenêtre ci-dessus annule l'enregistrement (pas de vidéo fantôme). */
    if (trigger === 'hold' && !didHoldFireRef.current) {
      abort()
      return
    }

    setRecording(true)
    /* Morph maintenu en position « enregistrement » même pour la minuterie
       mains-libres (qui ne passe pas par le pressIn). */
    animateMorph(1)
    setElapsed(0)
    elapsedRef.current = 0
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
    }, 1000)

    try {
      /* Retry borné : juste après la bascule picture → video, le capteur se
         reconfigure de façon asynchrone et `recordAsync` peut échouer
         (« Camera is not running »). On absorbe cette fenêtre sans que
         l'UI ait à connaître l'état interne d'expo-camera. */
      let recordedVideo: { uri?: string; duration?: number } | null = null
      for (let attempt = 0; attempt < 5 && !recordedVideo; attempt++) {
        try {
          const response = await camera.recordAsync({
            maxDuration: Math.max(1, Math.ceil(remainingDurationMs / 1000)),
          })
          recordedVideo = (response ?? null) as { uri?: string; duration?: number } | null
        } catch (error) {
          if (attempt === 4) throw error
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      }

      if (recordedVideo?.uri) {
        const rawDurationMs = recordedVideo.duration
          ? Number(recordedVideo.duration) > 1000
            ? Math.round(Number(recordedVideo.duration))
            : Math.round(Number(recordedVideo.duration) * 1000)
          : Math.max(1000, elapsedRef.current * 1000)

        addSegment({
          uri: recordedVideo.uri,
          durationMs: Math.min(rawDurationMs, remainingDurationMs),
          hasAudio: audioGranted,
        })
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'news.compose.record' })
    } finally {
      startPendingRef.current = false
      /* Fin de l'enregistrement : le morph revient au disque blanc. */
      animateMorph(0)
      clearTimer()
      setRecording(false)
      setElapsed(0)
      elapsedRef.current = 0
      /* Retour au mode de départ (picture en onglet photo, video en Reel). */
      setCameraMode(initialMode)
      holdIntentRef.current = false
    }
  }, [recording, micPermission, requestMicPermission, remainingDurationMs, canRecord, clearTimer, addSegment, animateMorph, initialMode, t.news.compose.errorTitle, t.news.compose.errorMicrophoneDenied])

  const startCountdown = useCallback(() => {
    if (recording || countdownRef.current || timerDelay <= 0 || !canRecord) return

    /* Mains-libres = enregistrement vidéo au bout du compte à rebours :
       on bascule le capteur dès maintenant pour que `recordAsync` soit
       prêt quand le compte à rebours expire. */
    setCameraMode('video')
    setCountdown(timerDelay)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearCountdown()
          void startRecording('timer')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [recording, timerDelay, canRecord, clearCountdown, startRecording])

  /* Annuler le compte à rebours = abandon du mode vidéo en attente. */
  const handleCancelCountdown = useCallback(() => {
    clearCountdown()
    setCameraMode('picture')
  }, [clearCountdown])

  /* ── Sauvegarde pellicule ──────────────────────────────────────── */
  /* Fire-and-forget : un échec n'interrompt jamais la capture. Seul un
     refus de permission désactive la préférence (avec un message), et une
     seule fois par session — une rafale ne doit pas ouvrir 10 dialogs. */
  const libraryDeniedAlertedRef = useRef(false)
  const saveCaptureToLibrary = useCallback(
    async (uri: string) => {
      if (!preferences.saveToLibrary) return
      const outcome = await saveMediaToLibrary(uri)
      if (outcome === 'denied' && !libraryDeniedAlertedRef.current) {
        libraryDeniedAlertedRef.current = true
        updatePreferences({ saveToLibrary: false })
        Alert.alert(t.news.compose.errorTitle, t.news.compose.saveToLibraryDenied)
      }
    },
    [
      preferences.saveToLibrary,
      updatePreferences,
      t.news.compose.errorTitle,
      t.news.compose.saveToLibraryDenied,
    ],
  )

  const confirmRecording = useCallback(async () => {
    if (recording || isFinalizing || segments.length === 0) return

    setIsFinalizing(true)
    try {
      const outputUri =
        segments.length === 1 ? segments[0].uri : await concatSegments(segments)
      const rawTotalMs = segments.reduce((sum, segment) => sum + segment.durationMs, 0)
      const speed = Number(captureSpeed)
      const duration = Math.max(1, Math.round(rawTotalMs / 1000 / speed))

      void saveCaptureToLibrary(outputUri)
      onCapture({
        uri: outputUri,
        type: 'video',
        duration,
        video: { ...DEFAULT_VIDEO_EDIT, speed },
        filterId: selectedFilterId === 'none' ? undefined : selectedFilterId,
      })
      /* La vignette galerie doit montrer la prise fraîche (Instagram). */
      void refreshGalleryThumb()
      resetSegments()
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'news.compose.segmentedConfirm',
      })
      Alert.alert(t.news.compose.errorTitle, t.news.compose.errorPublish)
    } finally {
      setIsFinalizing(false)
    }
  }, [
    captureSpeed,
    isFinalizing,
    onCapture,
    recording,
    refreshGalleryThumb,
    resetSegments,
    saveCaptureToLibrary,
    segments,
    selectedFilterId,
    t.news.compose.errorPublish,
    t.news.compose.errorTitle,
  ])

  /* ── Take photo ───────────────────────────────────────────────── */
  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const photo = await cameraRef.current.takePictureAsync({ quality: PHOTO_QUALITY })
      if (photo?.uri) {
        void saveCaptureToLibrary(photo.uri)
        onCapture({
          uri: photo.uri,
          type: 'image',
          width: photo.width,
          height: photo.height,
          filterId: selectedFilterId === 'none' ? undefined : selectedFilterId,
        })
        /* La vignette galerie doit montrer la prise fraîche (Instagram). */
        void refreshGalleryThumb()
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'news.compose.photo' })
    }
  }, [onCapture, refreshGalleryThumb, saveCaptureToLibrary, selectedFilterId])

  /* ── Déclencheur (comportement Instagram) ─────────────────────── */
  /* Tap = photo (ou compte à rebours si minuterie réglée, ou arrêt d'un
     enregistrement mains-libres) ; maintenir ≥ HOLD_THRESHOLD_MS = vidéo.
     Au franchissement du seuil on bascule `cameraMode` en 'video' et on
     lance `startRecording` directement depuis ce callback JS — volontairement
     AUCUN `useEffect` dans ce pipeline : expo-camera exige `mode='video'`
     pour `recordAsync`, et `startRecording` attend lui-même la reconfiguration
     du capteur (attente bornée + retry). Au relâché, `didHoldFireRef` dit si
     on était en vidéo. */
  const handleShutterPressIn = useCallback(() => {
    if (recording) return
    /* Mode vidéo imposé par l'onglet Reel : l'enregistrement démarre à
       l'appui, s'arrête au relâché. Pas besoin d'attendre le seuil de
       maintien (contrairement au geste photo → vidéo). */
    if (initialMode === 'video') {
      holdThresholdRef.current = null
      didHoldFireRef.current = true
      holdIntentRef.current = true
      animateMorph(1)
      void startRecording('hold')
      return
    }
    /* Mode photo : un appui court prend une photo ; le maintien bascule en
       vidéo (feed de secours). */ 
    holdThresholdRef.current = setTimeout(() => {
      holdThresholdRef.current = null
      didHoldFireRef.current = true
      holdIntentRef.current = true
      setCameraMode('video')
      animateMorph(1)
      void startRecording('hold')
    }, HOLD_THRESHOLD_MS)
  }, [recording, initialMode, startRecording, animateMorph])

  const handleShutterPressOut = useCallback(() => {
    if (holdThresholdRef.current) {
      clearTimeout(holdThresholdRef.current)
      holdThresholdRef.current = null
    }

    if (didHoldFireRef.current) {
      /* Le seuil « maintenir » a été franchi : on relâche un
         enregistrement en cours, ou on referme le mode vidéo si
         l'enregistrement n'a pas pu démarrer (micro refusé, durée max
         atteinte) pour revenir à l'état photo. Si un démarrage est encore
         en attente (caméra en cours de reconfiguration), on laisse le mode
         'video' actif : le relâchement n'annule pas le démarrage, c'est
         `startRecording` qui ré-évalue l'intention juste avant `recordAsync`
         (et referme le mode si l'intention est morte). */
      didHoldFireRef.current = false
      holdIntentRef.current = false
      if (recording) {
        stopRecording()
      } else if (startPendingRef.current) {
        /* Démarrage encore en attente : `startRecording` ré-évaluera
           l'intention et déroulera le morph si elle est morte, ou le
           prolongera via `recording` si elle aboutit. */
      } else {
        /* La vidéo n'a jamais démarré : on déroule le morph. */
        animateMorph(0)
        setCameraMode(initialMode)
      }
      return
    }

    if (recording) {
      /* Mains-libres (minuterie) : un tap arrête l'enregistrement. */
      stopRecording()
      return
    }

    if (timerDelay > 0) startCountdown()
    else void takePhoto()
  }, [recording, stopRecording, timerDelay, startCountdown, takePhoto, animateMorph, initialMode])

  /* ── Panneaux d'options du rail (pattern Instagram) ───────────── */
  const openToolSheet = useCallback((sheet: ToolSheetId) => {
    setToolSheet(sheet)
    toolSheetRef.current?.snapToIndex(0)
  }, [])

  /* Applique un choix puis referme le panneau. */
  const pickToolOption = useCallback((apply: () => void) => {
    apply()
    toolSheetRef.current?.close()
  }, [])

  /* Applique un réglage du panneau « Paramètres » puis le referme. */
  const applySetting = useCallback((apply: () => void) => {
    apply()
    settingsSheetRef.current?.close()
  }, [])

  /* Applique un filtre puis referme le panneau « Filtres ». */
  const pickFilter = useCallback((id: string) => {
    setSelectedFilterId(id)
    filtersSheetRef.current?.close()
  }, [])

  /* L'anneau s'efface tout seul après son animation. */
  const handleFocusAnimationComplete = useCallback(() => {
    setFocusPoint(null)
  }, [])

  /* ── Permission gate ──────────────────────────────────────────── */
  if (permission && !permission.granted) {
    return (
      <View style={styles.gate}>
        <Ionicons name="camera-outline" size={52} color={postColors.textTertiary} />
        <Text style={styles.gateText}>{t.news.compose.cameraPermission}</Text>
        <Pressable
          onPress={requestPermission}
          accessibilityRole="button"
          style={({ pressed }) => [styles.gateButton, pressed && styles.pressed]}
        >
          <Text style={styles.gateButtonText}>{t.news.compose.cameraAllow}</Text>
        </Pressable>
      </View>
    )
  }

  const remaining = Math.max(0, Math.ceil(remainingDurationMs / 1000) - elapsed)

  /* La qualité vidéo n'existe que sur Android, la stabilisation que sur iOS :
     expo-camera ne les expose pas sur l'autre plateforme. Les réglages ne
     présentent que ce que le capteur local sait faire (même règle que le
     rail d'outils). */
  const showVideoQuality = Platform.OS === 'android'
  const showVideoStabilization = Platform.OS === 'ios'

  return (
    <View style={styles.root}>
      {/* ── CameraView ─────────────────────────────────────────────── */}
      {isFocused && permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode={cameraMode}
          flash={flash}
          zoom={zoom}
          mirror={facing === 'front' && preferences.mirrorSelfie}
          videoQuality={preferences.videoQuality}
          videoStabilizationMode={preferences.videoStabilization ? 'standard' : 'off'}
          enableTorch={enableTorch}
          autofocus={facing === 'back' ? autofocus : 'off'}
          onMountError={(event) => {
            captureException(
              new Error(`Camera mount error: ${event.message}`),
              { context: 'news.compose.cameraMountError' },
            )
            Alert.alert(
              t.news.compose.errorTitle,
              t.news.compose.cameraMountError,
            )
          }}
        />
      ) : null}

      {/* Capteur de pince : posé sous les contrôles (rendus après lui, donc
          au-dessus), il ne réclame le geste qu'à deux doigts et laisse donc
          passer les appuis simples. */}
      <View
        style={StyleSheet.absoluteFill}
        {...pinchResponder.panHandlers}
        accessible
        accessibilityLabel={t.news.compose.a11yZoomReset}
      />

      {/* ── Overlays (grid, ratio mask) ────────────────────────────── */}
      <CameraOverlay showGrid={preferences.showGrid} aspectRatio={aspectRatio} />

      {/* Anneau de mise au point au tap */}
      <FocusIndicator
        point={focusPoint}
        onAnimationComplete={handleFocusAnimationComplete}
      />

      {countdown > 0 ? (
        <View style={styles.countdownOverlay} pointerEvents="box-none">
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
          <Pressable
            onPress={handleCancelCountdown}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yCancelCountdown}
            style={({ pressed }) => [styles.countdownCancel, pressed && styles.pressed]}
          >
            <Text style={styles.countdownCancelText}>{t.news.compose.cancelCountdown}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Top bar ────────────────────────────────────────────────── */}
      {/* Clone Instagram : les contrôles sont à droite (flash), le bouton
          retour/galerie du parent occupe la gauche via `topBarInset`. */}
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + postSpacing.gutter + topContentOffset },
          topBarInset ? { paddingLeft: topBarInset } : undefined,
        ]}
      >
        <View style={styles.topBarSpacer} />

        {/* Flash — un seul bouton contextuel (comportement Instagram) :
            en photo, cycle off → on → auto ; en vidéo, bascule la torche
            (lumière continue). Désactivé pendant l'enregistrement (le
            rendu en cours ne doit pas être modifié) et en frontale (la
            plupart des capteurs front n'ont pas de flash ; un cycle
            silencieux ferait croire à un bug). */}
        <Pressable
          onPress={() => {
            if (cameraMode === 'video') {
              setEnableTorch((prev) => !prev)
            } else {
              setFlash((f) => nextFlashMode(f))
            }
          }}
          disabled={recording || facing === 'front'}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={
            cameraMode === 'video'
              ? t.news.compose.a11yTorch
              : t.news.compose.a11yFlashMode.replace(
                  '{label}',
                  flash === 'on'
                    ? t.news.compose.flashOn
                    : flash === 'auto'
                      ? t.news.compose.flashAuto
                      : t.news.compose.flashOff,
                )
          }
          accessibilityState={{
            selected: cameraMode === 'video' ? enableTorch : flash === 'on',
          }}
          style={({ pressed }) => [
            styles.roundButton,
            (recording || facing === 'front') && styles.roundButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={
              cameraMode === 'video'
                ? enableTorch
                  ? 'flash'
                  : 'flash-off'
                : flash === 'off'
                  ? 'flash-off'
                  : flash === 'on'
                    ? 'flash'
                    : 'flash-outline'
            }
            size={20}
            color={
              cameraMode === 'video'
                ? enableTorch
                  ? cameraColors.torchActive
                  : postColors.onMedia
                : flash === 'on'
                  ? postColors.optionMood
                  : postColors.onMedia
            }
          />
        </Pressable>

        {/* Paramètres (réglages) : engrenage, visible photo + vidéo.
            Reproduit l'accès aux réglages d'expo-camera (qualité, stab,
            miroir, sauvegarde) sans dupliquer les options du rail. */}
        <Pressable
          onPress={() => {
            settingsSheetRef.current?.snapToIndex(0)
          }}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.a11ySettings}
          style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
        >
          <Ionicons
            name="settings-outline"
            size={20}
            color={postColors.onMedia}
          />
        </Pressable>

        {/* Terminer : visible dès que l'utilisateur a fait au moins une
            prise (Instagram : la validation n'apparaît qu'après le premier
            enregistrement). Désactivé pendant la finalisation et pendant
            un enregistrement en cours. */}
        {segments.length > 0 ? (
          <Pressable
            onPress={confirmRecording}
            disabled={isFinalizing || recording}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yFinishRecording}
            style={({ pressed }) => [
              styles.finishButton,
              (isFinalizing || recording) && styles.confirmButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.finishButtonText}>
              {isFinalizing ? t.news.compose.finalizing : t.news.compose.finishRecording}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── Rail d'outils vertical (clone caméra Instagram) ───────── */}
      <View style={styles.sideRail} pointerEvents="box-none">
        <CameraSideRail
          showGrid={preferences.showGrid}
          onToggleGrid={() => updatePreferences({ showGrid: !preferences.showGrid })}
          showMirror={facing === 'front'}
          mirrorSelfie={preferences.mirrorSelfie}
          onToggleMirror={() =>
            updatePreferences({ mirrorSelfie: !preferences.mirrorSelfie })
          }
          videoStabilization={preferences.videoStabilization}
          onToggleVideoStabilization={() =>
            updatePreferences({
              videoStabilization: !preferences.videoStabilization,
            })
          }
          ratioActive={aspectRatio !== '9:16'}
          speedActive={captureSpeed !== '1'}
          timerActive={timerDelay !== 0}
          durationActive={maxDuration !== 30}
          qualityActive={preferences.videoQuality !== '1080p'}
          ratioLabel={ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.label ?? ''}
          speedLabel={CAPTURE_SPEEDS.find((s) => s.value === captureSpeed)?.label ?? ''}
          timerLabel={formatDuration(timerDelay)}
          durationLabel={formatDuration(maxDuration)}
          qualityLabel={
            VIDEO_QUALITY_OPTIONS.find((q) => q.value === preferences.videoQuality)
              ?.label ?? ''
          }
          onOpenSheet={openToolSheet}
        />
      </View>

      {/* ── Bottom bar ─────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        {segments.length > 0 ? (
          <View style={styles.segmentedControls}>
            <SegmentedProgressBar
              segments={segments}
              totalDurationMs={totalDurationMs}
              maxDurationMs={maxDuration * 1000}
              onRemoveLast={removeLastSegment}
            />
          </View>
        ) : null}

        {/* Boîte audio + filtres (copie caméra Reel Instagram) : affichés
            dès qu'une première prise existe (comportement Instagram, où le
            son et le style se règlent après le premier clic). Le son et le
            filtre ne concernent que la vidéo. */}
        {segments.length > 0 ? (
          <View style={styles.captureToolsRow}>
            <Pressable
              onPress={onOpenSound}
              disabled={!onOpenSound || recording}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={
                soundId
                  ? t.news.compose.a11yChangeSound
                  : t.news.compose.a11yAddSound
              }
              style={({ pressed }) => [
                styles.soundPill,
                (recording || !onOpenSound) && styles.roundButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="musical-notes" size={16} color={postColors.onMedia} />
              <Text style={styles.soundPillText} numberOfLines={1}>
                {soundId
                  ? t.news.compose.musicPicked
                  : t.news.compose.addMusic}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                filtersSheetRef.current?.snapToIndex(0)
              }}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={t.news.compose.a11yFilters}
              style={({ pressed }) => [
                styles.soundPill,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="color-filter-outline"
                size={16}
                color={
                  selectedFilterId === 'none'
                    ? postColors.onMedia
                    : cameraColors.torchActive
                }
              />
              <Text style={styles.soundPillText} numberOfLines={1}>
                {selectedFilterId === 'none'
                  ? t.news.compose.filterOriginal
                  : t.news.compose.filterPicked.replace(
                      '{label}',
                      getFilter(selectedFilterId).name,
                    )}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Shutter row */}
        <View style={styles.shutterRow}>
          {/* Vignette galerie (clone Instagram) : dernière prise de la
              pellicule ; un appui ouvre la galerie. Sans permission ou
              pellicule vide, l'icône galerie reste le point d'entrée. */}
          <Pressable
            onPress={onOpenGallery}
            disabled={!onOpenGallery}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yOpenGallery}
            style={({ pressed }) => [
              styles.galleryThumb,
              !onOpenGallery && styles.roundButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            {galleryThumbAvailable && latestGalleryAsset ? (
              <Image
                source={{ uri: latestGalleryAsset.uri }}
                style={styles.galleryThumbImage}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <Ionicons name="images-outline" size={22} color={postColors.onMedia} />
            )}
          </Pressable>

          {/* Minuteur d'enregistrement au-dessus du déclencheur (Instagram) :
              pilule sombre + temps restant, affichée dès la première prise.
              Le point rouge pleine opacité pendant l'enregistrement,
              atténué en pause. */}
          {recording || segments.length > 0 ? (
            <View style={styles.shutterTimerOverlay} pointerEvents="none">
              <View style={styles.recTimerBadge}>
                <View style={[styles.recordDot, !recording && styles.recordDotIdle]} />
                <Text style={styles.recTimerText}>{formatTime(remaining)}</Text>
              </View>
            </View>
          ) : null}

          {/* Chips de zoom rapide au-dessus du déclencheur (reel Instagram).
              Presets approximatifs : `zoom` d'expo-camera est un pourcentage
              0..1 du zoom max, pas un facteur optique (voir editing.ts). */}
          <View style={styles.zoomChipsOverlay} pointerEvents="box-none">
            {ZOOM_PRESETS.map((preset) => {
              const active = Math.abs(zoom - preset.zoom) < 0.001
              return (
                <Pressable
                  key={preset.label}
                  onPress={() => {
                    applyZoom(preset.zoom)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={t.news.compose.a11yZoomPreset.replace(
                    '{label}',
                    preset.label,
                  )}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.zoomChip,
                    active && styles.zoomChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.zoomChipText, active && styles.zoomChipTextActive]}>
                    {preset.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Pressable
            onPressIn={handleShutterPressIn}
            onPressOut={handleShutterPressOut}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={
              recording ? t.news.compose.a11yRecord : t.news.compose.a11yShutter
            }
            /* Pas de dim pendant l'enregistrement (Instagram : le bouton
               reste plein pendant le hold). */
            style={({ pressed }) => [
              styles.shutterOuter,
              shutterRingStyle,
              pressed && !recording && styles.pressed,
            ]}
          >
            <Animated.View style={[styles.shutterInner, shutterMorphStyle]} />
            {ringVisible ? (
              <View style={styles.shutterRingOverlay} pointerEvents="none">
                <ProgressRing
                  size={SHUTTER_OUTER_SIZE}
                  strokeWidth={SHUTTER_RING_STROKE}
                  progress={ringProgress}
                  color={ringColor}
                  trackColor={postColors.onMedia}
                  animationMs={RING_ANIMATION_MS}
                />
              </View>
            ) : null}
          </Pressable>

          {/* Flip caméra : à droite du déclencheur, comme Instagram */}
          <Pressable
            onPress={handleFlipCamera}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yFlipCamera}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          >
            <Ionicons name="camera-reverse" size={24} color={postColors.onMedia} />
          </Pressable>
        </View>
      </View>

      {/* ── Panneau d'options du rail (pattern Instagram) ─────────── */}
      <MboloBottomSheet
        sheetRef={toolSheetRef}
        snapPoints={['42%']}
        title={
          toolSheet === 'ratio'
            ? t.news.compose.sheetTitleRatio
            : toolSheet === 'speed'
              ? t.news.compose.sheetTitleSpeed
              : toolSheet === 'timer'
                ? t.news.compose.sheetTitleTimer
                : toolSheet === 'duration'
                  ? t.news.compose.sheetTitleDuration
                  : toolSheet === 'quality'
                    ? t.news.compose.sheetTitleQuality
                    : undefined
        }
        onClose={() => setToolSheet(null)}
        contentStyle={styles.sheetContent}
      >
        {toolSheet === 'ratio'
          ? ASPECT_RATIOS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() =>
                  pickToolOption(() => setAspectRatio(option.value))
                }
                accessibilityRole="button"
                accessibilityLabel={`${t.news.compose.sheetTitleRatio} ${option.label} ${
                  aspectRatio === option.value ? t.news.compose.optionSelected : ''
                }`}
                accessibilityState={{ selected: aspectRatio === option.value }}
                style={({ pressed }) => [
                  styles.optionRow,
                  aspectRatio === option.value && styles.optionRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    aspectRatio === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {aspectRatio === option.value ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={cameraColors.chipContentActive}
                  />
                ) : null}
              </Pressable>
            ))
          : null}

        {toolSheet === 'speed'
          ? CAPTURE_SPEEDS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() =>
                  pickToolOption(() => setCaptureSpeed(option.value))
                }
                accessibilityRole="button"
                accessibilityLabel={`${t.news.compose.sheetTitleSpeed} ${option.label} ${
                  captureSpeed === option.value ? t.news.compose.optionSelected : ''
                }`}
                accessibilityState={{ selected: captureSpeed === option.value }}
                style={({ pressed }) => [
                  styles.optionRow,
                  captureSpeed === option.value && styles.optionRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    captureSpeed === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {captureSpeed === option.value ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={cameraColors.chipContentActive}
                  />
                ) : null}
              </Pressable>
            ))
          : null}

        {toolSheet === 'timer'
          ? TIMER_OPTIONS.map((delay) => (
              <Pressable
                key={delay}
                onPress={() =>
                  pickToolOption(() => setTimerDelay(delay))
                }
                accessibilityRole="button"
                accessibilityLabel={`${t.news.compose.sheetTitleTimer} ${formatDuration(delay)} ${
                  timerDelay === delay ? t.news.compose.optionSelected : ''
                }`}
                accessibilityState={{ selected: timerDelay === delay }}
                style={({ pressed }) => [
                  styles.optionRow,
                  timerDelay === delay && styles.optionRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    timerDelay === delay && styles.optionTextActive,
                  ]}
                >
                  {formatDuration(delay)}
                </Text>
                {timerDelay === delay ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={cameraColors.chipContentActive}
                  />
                ) : null}
              </Pressable>
            ))
          : null}

        {toolSheet === 'duration'
          ? DURATION_OPTIONS.map((duration) => (
              <Pressable
                key={duration}
                onPress={() =>
                  pickToolOption(() => setMaxDuration(duration))
                }
                accessibilityRole="button"
                accessibilityLabel={`${t.news.compose.sheetTitleDuration} ${formatDuration(duration)} ${
                  maxDuration === duration ? t.news.compose.optionSelected : ''
                }`}
                accessibilityState={{ selected: maxDuration === duration }}
                style={({ pressed }) => [
                  styles.optionRow,
                  maxDuration === duration && styles.optionRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    maxDuration === duration && styles.optionTextActive,
                  ]}
                >
                  {formatDuration(duration)}
                </Text>
                {maxDuration === duration ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={cameraColors.chipContentActive}
                  />
                ) : null}
              </Pressable>
            ))
          : null}

        {toolSheet === 'quality'
          ? VIDEO_QUALITY_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() =>
                  pickToolOption(() => updatePreferences({ videoQuality: option.value }))
                }
                accessibilityRole="button"
                accessibilityLabel={`${t.news.compose.sheetTitleQuality} ${option.label} ${
                  preferences.videoQuality === option.value
                    ? t.news.compose.optionSelected
                    : ''
                }`}
                accessibilityState={{ selected: preferences.videoQuality === option.value }}
                style={({ pressed }) => [
                  styles.optionRow,
                  preferences.videoQuality === option.value && styles.optionRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    preferences.videoQuality === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {preferences.videoQuality === option.value ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={cameraColors.chipContentActive}
                  />
                ) : null}
              </Pressable>
            ))
          : null}
      </MboloBottomSheet>

      {/* ── Panneau « Paramètres » (engrenage) ────────────────────── */}
      <MboloBottomSheet
        sheetRef={settingsSheetRef}
        snapPoints={['42%']}
        title={t.news.compose.sheetTitleSettings}
        onClose={undefined}
        contentStyle={styles.sheetContent}
      >
        {showVideoQuality ? (
          <Pressable
            onPress={() =>
              applySetting(() =>
                updatePreferences({
                  videoQuality:
                    preferences.videoQuality === '720p'
                      ? '1080p'
                      : preferences.videoQuality === '1080p'
                        ? '2160p'
                        : '720p',
                }),
              )
            }
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11ySettingsQuality.replace(
              '{label}',
              preferences.videoQuality,
            )}
            accessibilityState={{ selected: true }}
            style={({ pressed }) => [
              styles.optionRow,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.optionText}>
              {t.news.compose.settingsQualityLabel}
            </Text>
            <Text style={styles.optionValue}>{preferences.videoQuality}</Text>
          </Pressable>
        ) : null}

        {showVideoStabilization ? (
          <Pressable
            onPress={() =>
              applySetting(() =>
                updatePreferences({
                  videoStabilization: !preferences.videoStabilization,
                }),
              )
            }
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yVideoStabilization}
            accessibilityState={{ selected: preferences.videoStabilization }}
            style={({ pressed }) => [
              styles.optionRow,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.optionText}>
              {t.news.compose.settingsStabilizationLabel}
            </Text>
            <Ionicons
              name={preferences.videoStabilization ? 'checkmark' : 'ellipse-outline'}
              size={18}
              color={cameraColors.chipContentActive}
            />
          </Pressable>
        ) : null}

        <Pressable
          onPress={() =>
            applySetting(() =>
              updatePreferences({ saveToLibrary: !preferences.saveToLibrary }),
            )
          }
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.a11ySaveToLibrary}
          accessibilityState={{ selected: preferences.saveToLibrary }}
          style={({ pressed }) => [
            styles.optionRow,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.optionText}>
            {t.news.compose.settingsSaveLabel}
          </Text>
          <Ionicons
            name={preferences.saveToLibrary ? 'checkmark' : 'ellipse-outline'}
            size={18}
            color={cameraColors.chipContentActive}
          />
        </Pressable>
      </MboloBottomSheet>

      {/* ── Panneau « Filtres » ───────────────────────────────────── */}
      <MboloBottomSheet
        sheetRef={filtersSheetRef}
        snapPoints={['55%']}
        title={t.news.compose.sheetTitleFilters}
        onClose={undefined}
        contentStyle={styles.filtersContent}
      >
        {FILTERS.map((filter) => {
            const active = selectedFilterId === filter.id
            return (
              <Pressable
                key={filter.id}
                onPress={() => pickFilter(filter.id)}
                accessibilityRole="button"
                accessibilityLabel={`${t.news.compose.sheetTitleFilters} ${filter.name}`}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.optionRow,
                  active && styles.optionRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    active && styles.optionTextActive,
                  ]}
                >
                  {filter.name}
                </Text>
                {active ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={cameraColors.chipContentActive}
                  />
                ) : null}
              </Pressable>
            )
          })}
      </MboloBottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: postColors.cameraBackdrop },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: postSpacing.gutter,
    padding: postSpacing.gutter,
  },
  /* Pousse les contrôles à droite (le parent occupe la gauche avec son
     bouton retour/galerie). */
  topBarSpacer: {
    flex: 1,
  },
  /* Rail d'outils vertical sur le bord gauche, centré dans la bande utile
     entre la top bar et les contrôles bas (clone Instagram). Absolu pour
     ne pas pousser la bottom bar. */
  sideRail: {
    position: 'absolute',
    left: postSpacing.gutter,
    top: 96,
    bottom: 190,
    zIndex: 10,
    justifyContent: 'center',
  },
  /* Bouton « Terminer » de la top bar : pilule accent compacte, alignée
     verticalement avec les boutons ronds (flash, flip). */
  finishButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: postColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonText: {
    color: postColors.onMedia,
    fontWeight: '700',
  },
  confirmButtonDisabled: {
    backgroundColor: postColors.scrimHeavy,
  },

  /* Minuteur d'enregistrement au-dessus du déclencheur : pilule sombre
     compacte avec point d'enregistrement et temps restant (Instagram). */
  shutterTimerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: SHUTTER_OUTER_SIZE + 14,
    alignItems: 'center',
  },
  recTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.inlineGap,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: postRadius.chip,
    backgroundColor: postColors.scrimHeavy,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: postColors.recordActive,
  },
  /* Point atténué hors enregistrement (pause) : l'enregistrement en cours
     est signalé par le point plein. */
  recordDotIdle: {
    opacity: 0.4,
  },
  recTimerText: {
    color: postColors.onMedia,
    fontVariant: ['tabular-nums'],
    ...postType.mediaDuration,
  },

  bottomBar: {
    marginTop: 'auto',
    paddingBottom: 28,
    gap: postSpacing.rowGap,
  },

  segmentedControls: {
    gap: 10,
    paddingHorizontal: 16,
  },
  /* Boîte audio + filtres : deux pilules au-dessus du déclencheur (reel
     Instagram), affichées dès la première prise. */
  captureToolsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: postSpacing.gutter,
    paddingHorizontal: 16,
  },
  soundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 180,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: postRadius.chip,
    backgroundColor: postColors.scrimHeavy,
  },
  soundPillText: {
    color: postColors.onMedia,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  filtersContent: {
    paddingHorizontal: postSpacing.gutter,
    gap: postSpacing.rowGap,
    maxHeight: 340,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 16,
    paddingHorizontal: 24,
  },
  countdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 2,
    borderColor: postColors.accent,
  },
  countdownText: {
    color: postColors.onMedia,
    fontSize: 56,
    fontWeight: '800',
  },
  countdownCancel: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: postColors.scrimHeavy,
  },
  countdownCancelText: {
    color: postColors.textPrimary,
    fontWeight: '600',
  },

  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrimHeavy,
  },
  roundButtonDisabled: {
    opacity: postMotion.pressedOpacity,
  },
  /* Vignette galerie sous le déclencheur (clone Instagram) : dernière
     prise de la pellicule, tap = ouvrir la galerie. */
  galleryThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrimHeavy,
    borderWidth: 1.5,
    borderColor: postColors.onMedia,
    overflow: 'hidden',
  },
  galleryThumbImage: {
    width: '100%',
    height: '100%',
  },
  /* Chips de zoom rapide au-dessus du déclencheur (reel Instagram). */
  zoomChipsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: SHUTTER_OUTER_SIZE + 50,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  zoomChip: {
    minWidth: 40,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrimHeavy,
  },
  zoomChipActive: {
    backgroundColor: postColors.onMedia,
  },
  zoomChipText: {
    color: postColors.onMedia,
    ...postType.mediaDuration,
  },
  zoomChipTextActive: {
    color: postColors.cameraBackdrop,
  },

  shutterOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: postColors.onMedia,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Le disque blanc, mue en carré rouge par `shutterMorphStyle`. */
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: postColors.onMedia,
  },
  /* Minuteur Instagram : l'anneau de progression recouvre la bordure du
     déclencheur sans capter les gestes. */
  shutterRingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Panneau d'options du rail (pattern Instagram). */
  sheetContent: {
    paddingHorizontal: postSpacing.gutter,
    gap: postSpacing.rowGap,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: postRadius.chip,
    backgroundColor: cameraColors.chipIdle,
  },
  optionRowActive: {
    backgroundColor: cameraColors.chipActive,
  },
  optionText: {
    color: cameraColors.chipContentIdle,
    fontSize: 15,
    fontWeight: '500',
  },
  optionTextActive: {
    color: cameraColors.chipContentActive,
  },
  /* Valeur courante d'un réglage du panneau « Paramètres » (à droite). */
  optionValue: {
    color: cameraColors.chipContentIdle,
    fontSize: 15,
    fontWeight: '600',
  },

  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: postSpacing.gutter,
    paddingHorizontal: 40,
    backgroundColor: postColors.cameraBackdrop,
  },
  gateText: { textAlign: 'center', color: postColors.textSecondary, ...postType.body },
  gateButton: {
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: postRadius.chip,
    backgroundColor: postColors.accent,
  },
  gateButtonText: { color: postColors.onMedia, ...postType.link },
  pressed: { opacity: postMotion.pressedOpacity },
})
