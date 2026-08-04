/* src/features/news/components/compose/ComposeCamera.tsx

   Caméra studio (style TikTok).

   Fonctionnalités :
   - Photo / vidéo (toggle mode)
   - Flash (on/off)
   - Switch caméra avant/arrière
   - Timer (none, 3s, 10s)
   - Zoom pince (PanResponder, 0..1 du zoom max de l'appareil)
   - Grid of thirds
   - Ratio d'aspect (9:16, 1:1, 4:5, 16:9, Original)
   - Mode rafale (burst, photo uniquement)
   - Vitesse de capture vidéo (0.3x → 3x)
   - Pause/reprise vidéo
   - Barre d'outils avec sélection ratio, vitesse, durée, grid

   Le composant ne navigue pas : il remonte le média par `onCapture` et
   laisse l'orchestrateur décider de la suite. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import type { GestureResponderEvent, NativeTouchEvent } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useIsFocused } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
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
import type { AspectRatioValue, CaptureSpeed } from '@/features/create/types/editing'
import { DEFAULT_VIDEO_EDIT } from '@/features/create/types/editing'
import { CameraOverlay } from '@/features/create/components/camera/CameraOverlay'
import { CameraToolbar } from '@/features/create/components/camera/CameraToolbar'

type CaptureMode = 'photo' | 'video'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const BURST_INTERVAL_MS = 150
const DEFAULT_BURST_LIMIT = 10
/** Compromis Instagram : au-delà, le poids monte sans gain visible. */
const PHOTO_QUALITY = 0.8
/* `zoom` d'expo-camera est un pourcentage du zoom max de l'appareil (0..1),
   pas un facteur optique. */
const MIN_ZOOM = 0
const MAX_ZOOM = 1
/* Écart de doigts (px) au-delà duquel on couvre toute la plage de zoom.
   Plus la valeur est haute, plus le geste est fin. */
const PINCH_RANGE_PX = 400

function touchDistance(touches: NativeTouchEvent[]): number {
  const [a, b] = touches
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)
}

interface ComposeCameraProps {
  /** Capture unitaire : une photo ou une vidéo. */
  onCapture: (media: SelectedMedia) => void
  /* Rafale : les clichés arrivent groupés, pour que le parent puisse en
     faire un carrousel plutôt que d'écraser chaque photo par la suivante.
     Sans ce callback, le mode rafale est indisponible. */
  onCaptureBurst?: (media: SelectedMedia[]) => void
  /* Nombre max de clichés par rafale. Le parent le fixe sur sa propre
     limite de carrousel : capturer au-delà remplirait le disque pour rien. */
  burstLimit?: number
  /* Décalage horizontal du topBar pour laisser de la place à un bouton
     overlay (ex. bouton retour dans SelectScreen). */
  topBarInset?: number
}

export function ComposeCamera({
  onCapture,
  onCaptureBurst,
  burstLimit = DEFAULT_BURST_LIMIT,
  topBarInset,
}: ComposeCameraProps) {
  const { t } = useI18n()
  const isFocused = useIsFocused()
  const cameraRef = useRef<CameraView>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /* Drapeau de rafale en cours : lu dans une boucle async, il doit être
     une ref (un state serait figé à la valeur du rendu qui l'a lancée). */
  const burstActiveRef = useRef(false)
  const mountedRef = useRef(true)

  const [permission, requestPermission] = useCameraPermissions()
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo')
  const [facing, setFacing] = useState<'back' | 'front'>('back')
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [maxDuration, setMaxDuration] = useState<number>(30)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)

  /* ── Nouvel état caméra studio ─────────────────────────────────── */
  const [showGrid, setShowGrid] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>('9:16')
  const [captureSpeed, setCaptureSpeed] = useState<CaptureSpeed>('1')
  const [isBursting, setIsBursting] = useState(false)
  const [burstCount, setBurstCount] = useState(0)
  const [zoom, setZoom] = useState(MIN_ZOOM)

  /* ── Pinch-to-zoom ────────────────────────────────────────────── */
  /* `PanResponder` plutôt que `react-native-gesture-handler` : envelopper
     `CameraView` dans un `GestureDetector` fait planter l'app sous Expo Go.
     La prop `isPinchToZoomEnabled` d'expo-camera 17 n'existe que sur les
     options de scan de code-barres, pas sur `CameraView`. */
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null)
  const zoomRef = useRef(MIN_ZOOM)

  const pinchResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event: GestureResponderEvent) =>
          event.nativeEvent.touches.length === 2,
        onMoveShouldSetPanResponder: (event: GestureResponderEvent) =>
          event.nativeEvent.touches.length === 2,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          const { touches } = event.nativeEvent
          if (touches.length !== 2) return
          pinchStartRef.current = { distance: touchDistance(touches), zoom: zoomRef.current }
        },
        onPanResponderMove: (event: GestureResponderEvent) => {
          const { touches } = event.nativeEvent
          const start = pinchStartRef.current
          /* Un doigt levé en cours de geste : on attend le prochain pinch
             plutôt que d'interpréter le mouvement restant comme un zoom. */
          if (touches.length !== 2 || !start) return
          const delta = (touchDistance(touches) - start.distance) / PINCH_RANGE_PX
          const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom + delta))
          zoomRef.current = next
          setZoom(next)
        },
        onPanResponderRelease: () => {
          pinchStartRef.current = null
        },
        onPanResponderTerminate: () => {
          pinchStartRef.current = null
        },
      }),
    [],
  )

  /* Le zoom est propre à l'objectif : le garder au retournement donnerait
     un cadrage arbitraire sur la caméra frontale. */
  const handleFlipCamera = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'))
    zoomRef.current = MIN_ZOOM
    setZoom(MIN_ZOOM)
  }, [])

  /* ── Timer enregistrement ─────────────────────────────────────── */
  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  /* ── Stop recording ───────────────────────────────────────────── */
  const stopRecording = useCallback(() => {
    if (!cameraRef.current || !recording) return
    cameraRef.current.stopRecording()
  }, [recording])

  useEffect(() => {
    if (!isFocused && recording) stopRecording()
  }, [isFocused, recording, stopRecording])

  /* ── Start recording ──────────────────────────────────────────── */
  const startRecording = useCallback(async () => {
    if (!cameraRef.current || recording) return

    setRecording(true)
    setElapsed(0)
    elapsedRef.current = 0
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
    }, 1000)

    try {
      const video = await cameraRef.current.recordAsync({ maxDuration })
      if (video?.uri) {
        const speed = Number(captureSpeed)
        onCapture({
          uri: video.uri,
          type: 'video',
          /* Durée après application de la vitesse : à 2x, la vidéo rendue
             dure deux fois moins longtemps que la prise de vue. */
          duration: Math.max(1, Math.round(elapsedRef.current / speed)),
          /* La vitesse n'est pas appliquée à la capture (expo-camera filme
             toujours en temps réel) mais au rendu FFmpeg. */
          video: { ...DEFAULT_VIDEO_EDIT, speed },
        })
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'news.compose.record' })
    } finally {
      clearTimer()
      setRecording(false)
      setElapsed(0)
      elapsedRef.current = 0
    }
  }, [recording, maxDuration, onCapture, clearTimer, captureSpeed])

  /* ── Take photo ───────────────────────────────────────────────── */
  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const photo = await cameraRef.current.takePictureAsync({ quality: PHOTO_QUALITY })
      if (photo?.uri) {
        onCapture({
          uri: photo.uri,
          type: 'image',
          width: photo.width,
          height: photo.height,
        })
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'news.compose.photo' })
    }
  }, [onCapture])

  /* ── Burst mode ───────────────────────────────────────────────── */
  /* Boucle séquentielle plutôt qu'un setInterval : `takePictureAsync`
     peut dépasser l'intervalle, et deux prises concurrentes sur la même
     référence caméra font échouer la seconde. On attend donc chaque
     cliché avant de programmer le suivant. */
  const runBurst = useCallback(async () => {
    const frames: SelectedMedia[] = []

    try {
      while (burstActiveRef.current && frames.length < burstLimit) {
        if (!cameraRef.current) break

        const photo = await cameraRef.current.takePictureAsync({ quality: PHOTO_QUALITY })
        if (photo?.uri) {
          frames.push({
            uri: photo.uri,
            type: 'image',
            width: photo.width,
            height: photo.height,
          })
          if (mountedRef.current) setBurstCount(frames.length)
        }

        if (!burstActiveRef.current || frames.length >= burstLimit) break
        await new Promise((resolve) => setTimeout(resolve, BURST_INTERVAL_MS))
      }
    } catch (e) {
      /* Une prise ratée n'annule pas la rafale : on remonte ce qui a été
         capturé avant l'erreur plutôt que de tout perdre. */
      captureException(e instanceof Error ? e : new Error(String(e)), {
        context: 'news.compose.burst',
      })
    } finally {
      burstActiveRef.current = false
      if (mountedRef.current) {
        setIsBursting(false)
        setBurstCount(0)
      }
      if (frames.length > 0) onCaptureBurst?.(frames)
    }
  }, [burstLimit, onCaptureBurst])

  const startBurst = useCallback(() => {
    /* Sans `onCaptureBurst`, les clichés n'auraient nulle part où aller. */
    if (!onCaptureBurst || captureMode !== 'photo' || burstActiveRef.current) return
    burstActiveRef.current = true
    setIsBursting(true)
    setBurstCount(0)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    void runBurst()
  }, [onCaptureBurst, captureMode, runBurst])

  const stopBurst = useCallback(() => {
    burstActiveRef.current = false
  }, [])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      burstActiveRef.current = false
    }
  }, [])

  /* ── Shutter handler ──────────────────────────────────────────── */
  /* `onPress` ne se déclenche pas quand `onLongPress` a répondu : un appui
     court prend une photo, un appui maintenu lance la rafale, et le relâché
     (`onPressOut`) l'arrête — comme la rafale iOS. */
  const handleShutter = useCallback(() => {
    if (captureMode === 'photo') {
      takePhoto()
      return
    }
    if (recording) stopRecording()
    else startRecording()
  }, [captureMode, recording, takePhoto, startRecording, stopRecording])

  const handlePressOut = useCallback(() => {
    stopBurst()
  }, [stopBurst])

  const handleSwitchMode = useCallback((next: CaptureMode) => {
    if (recording) return
    setCaptureMode(next)
  }, [recording])

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

  const remaining = Math.max(0, maxDuration - elapsed)

  return (
    <View style={styles.root}>
      {/* ── CameraView ─────────────────────────────────────────────── */}
      {isFocused && permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode={captureMode === 'video' ? 'video' : 'picture'}
          flash={flash}
          zoom={zoom}
        />
      ) : null}

      {/* Capteur de pince : posé sous les contrôles (rendus après lui, donc
          au-dessus), il ne réclame le geste qu'à deux doigts et laisse donc
          passer les appuis simples. */}
      <View style={StyleSheet.absoluteFill} {...pinchResponder.panHandlers} />

      {/* ── Overlays (grid, ratio mask) ────────────────────────────── */}
      <CameraOverlay showGrid={showGrid} aspectRatio={aspectRatio} />

      {/* ── Top bar ────────────────────────────────────────────────── */}
      <View style={[styles.topBar, topBarInset ? { paddingLeft: topBarInset } : undefined]}>
        <Pressable
          onPress={() => setFlash((f) => (f === 'on' ? 'off' : 'on'))}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.a11yFlash}
          accessibilityState={{ selected: flash === 'on' }}
          style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
        >
          <Ionicons
            name={flash === 'on' ? 'flash' : 'flash-off'}
            size={20}
            color={flash === 'on' ? postColors.optionMood : postColors.onMedia}
          />
        </Pressable>

        {recording ? (
          <View style={styles.timer}>
            <View style={styles.recordDot} />
            <Text style={styles.timerText}>{formatTime(remaining)}</Text>
          </View>
        ) : null}

        {/* Burst counter */}
        {isBursting ? (
          <View style={styles.timer}>
            <Ionicons name="camera" size={14} color="#fff" />
            <Text style={styles.timerText}>{burstCount}</Text>
          </View>
        ) : null}
      </View>

      {/* ── Bottom bar ─────────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        {/* Camera toolbar (ratio, speed, grid, duration) */}
        <CameraToolbar
          captureMode={captureMode}
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          captureSpeed={captureSpeed}
          onCaptureSpeedChange={setCaptureSpeed}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((v) => !v)}
          maxDuration={maxDuration}
          onMaxDurationChange={setMaxDuration}
        />

        {/* Shutter row */}
        <View style={styles.shutterRow}>
          <Pressable
            onPress={handleFlipCamera}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yFlipCamera}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          >
            <Ionicons name="camera-reverse" size={24} color={postColors.onMedia} />
          </Pressable>

          <Pressable
            onPress={handleShutter}
            onLongPress={startBurst}
            onPressOut={handlePressOut}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={
              captureMode === 'photo' ? t.news.compose.a11yShutter : t.news.compose.a11yRecord
            }
            style={({ pressed }) => [styles.shutterOuter, pressed && styles.pressed]}
          >
            <View style={[styles.shutterInner, recording && styles.shutterRecording]} />
          </Pressable>

          <View style={styles.roundButton} />
        </View>

        {/* Mode selector */}
        <View style={styles.modes}>
          {(['photo', 'video'] as const).map((item) => (
            <Pressable
              key={item}
              onPress={() => handleSwitchMode(item)}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityState={{ selected: captureMode === item }}
              style={({ pressed }) => [styles.mode, pressed && styles.pressed]}
            >
              <Text
                style={[styles.modeText, captureMode === item && styles.modeTextOn]}
              >
                {item === 'photo' ? t.news.compose.cameraPhoto : t.news.compose.cameraVideo}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: postColors.cameraBackdrop },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.gutter,
    padding: postSpacing.gutter,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.inlineGap,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: postRadius.chip,
    backgroundColor: postColors.scrimHeavy,
  },
  recordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: postColors.recordActive,
  },
  timerText: {
    color: postColors.onMedia,
    fontVariant: ['tabular-nums'],
    ...postType.mediaDuration,
  },

  bottomBar: {
    marginTop: 'auto',
    paddingBottom: 28,
    gap: postSpacing.rowGap,
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
  shutterOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: postColors.onMedia,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: postColors.onMedia,
  },
  shutterRecording: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: postColors.recordActive,
  },

  modes: { flexDirection: 'row', justifyContent: 'center', gap: postSpacing.gutter },
  mode: { paddingVertical: 5, paddingHorizontal: 12 },
  modeText: { color: postColors.textTertiary, ...postType.composeTab },
  modeTextOn: { color: postColors.onMedia },

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
