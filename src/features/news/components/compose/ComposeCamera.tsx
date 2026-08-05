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
import { Alert, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import type { GestureResponderEvent, NativeTouchEvent } from 'react-native'
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera'
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
import type {
  AspectRatioValue,
  CaptureSpeed,
  FlashMode,
  VideoQualityOption,
} from '@/features/create/types/editing'
import { DEFAULT_VIDEO_EDIT, nextFlashMode } from '@/features/create/types/editing'
import { CameraOverlay } from '@/features/create/components/camera/CameraOverlay'
import { CameraToolbar } from '@/features/create/components/camera/CameraToolbar'
import { SegmentedProgressBar } from '@/features/create/components/camera/SegmentedProgressBar'
import { useSegmentedRecording } from '@/features/create/hooks/useSegmentedRecording'
import { useCameraPreferences } from '@/features/create/hooks/useCameraPreferences'
import { concatSegments } from '@/features/create/utils/concatSegments'
import { saveMediaToLibrary } from '@/features/create/utils/cameraRoll'

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
  const [micPermission, requestMicPermission] = useMicrophonePermissions()
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo')
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

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = null
    setCountdown(0)
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
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
  const startRecording = useCallback(async () => {
    if (!cameraRef.current || recording || !canRecord) return

    let audioGranted = micPermission?.granted ?? false

    if (captureMode === 'video' && !audioGranted) {
      const result = await requestMicPermission()
      if (!result.granted) {
        Alert.alert(
          t.news.compose.errorTitle,
          t.news.compose.errorMicrophoneDenied,
        )
        return
      }
      audioGranted = true
    }

    setRecording(true)
    setElapsed(0)
    elapsedRef.current = 0
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
    }, 1000)

    try {
      const recordedVideo = await cameraRef.current.recordAsync({
        maxDuration: Math.max(1, Math.ceil(remainingDurationMs / 1000)),
      })
      const video = recordedVideo as { uri?: string; duration?: number }

      if (video?.uri) {
        const rawDurationMs = video.duration
          ? Number(video.duration) > 1000
            ? Math.round(Number(video.duration))
            : Math.round(Number(video.duration) * 1000)
          : Math.max(1000, elapsedRef.current * 1000)

        addSegment({
          uri: video.uri,
          durationMs: Math.min(rawDurationMs, remainingDurationMs),
          hasAudio: audioGranted,
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
  }, [recording, captureMode, micPermission, requestMicPermission, remainingDurationMs, canRecord, clearTimer, addSegment, t.news.compose.errorTitle, t.news.compose.errorMicrophoneDenied])

  const startCountdown = useCallback(() => {
    if (recording || countdownRef.current || timerDelay <= 0 || !canRecord) return

    setCountdown(timerDelay)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearCountdown()
          void startRecording()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [recording, timerDelay, canRecord, clearCountdown, startRecording])

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
      })
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
    resetSegments,
    saveCaptureToLibrary,
    segments,
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
        })
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'news.compose.photo' })
    }
  }, [onCapture, saveCaptureToLibrary])

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
          /* Non bloquant : le compteur de rafale ne doit pas attendre les
             écritures disque (spéc. catégorie 2). */
          void saveCaptureToLibrary(photo.uri)
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
  }, [burstLimit, onCaptureBurst, saveCaptureToLibrary])

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
    if (recording) {
      stopRecording()
      return
    }
    if (timerDelay > 0) {
      startCountdown()
      return
    }
    void startRecording()
  }, [captureMode, recording, takePhoto, startRecording, startCountdown, stopRecording, timerDelay])

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

  if (captureMode === 'video' && micPermission && !micPermission.granted) {
    return (
      <View style={styles.gate}>
        <Ionicons name="mic-off-outline" size={52} color={postColors.textTertiary} />
        <Text style={styles.gateText}>{t.news.compose.microphonePermission}</Text>
        <Pressable
          onPress={requestMicPermission}
          accessibilityRole="button"
          style={({ pressed }) => [styles.gateButton, pressed && styles.pressed]}
        >
          <Text style={styles.gateButtonText}>{t.news.compose.cameraAllow}</Text>
        </Pressable>
      </View>
    )
  }

  const remaining = Math.max(0, Math.ceil(remainingDurationMs / 1000) - elapsed)

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
          mirror={facing === 'front' && preferences.mirrorSelfie}
          videoQuality={preferences.videoQuality}
          videoStabilizationMode={preferences.videoStabilization ? 'standard' : 'off'}
        />
      ) : null}

      {/* Capteur de pince : posé sous les contrôles (rendus après lui, donc
          au-dessus), il ne réclame le geste qu'à deux doigts et laisse donc
          passer les appuis simples. */}
      <View style={StyleSheet.absoluteFill} {...pinchResponder.panHandlers} />

      {/* ── Overlays (grid, ratio mask) ────────────────────────────── */}
      <CameraOverlay showGrid={preferences.showGrid} aspectRatio={aspectRatio} />

      {countdown > 0 ? (
        <View style={styles.countdownOverlay} pointerEvents="box-none">
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
          <Pressable
            onPress={clearCountdown}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yCancelCountdown}
            style={({ pressed }) => [styles.countdownCancel, pressed && styles.pressed]}
          >
            <Text style={styles.countdownCancelText}>{t.news.compose.cancelCountdown}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Top bar ────────────────────────────────────────────────── */}
      <View style={[styles.topBar, topBarInset ? { paddingLeft: topBarInset } : undefined]}>
        {/* Flash : cycle off → on → auto. Désactivé pendant l'enregistrement
            (le rendu en cours ne doit pas être modifié) et en frontale (la
            plupart des capteurs front n'ont pas de flash ; un cycle silencieux
            ferait croire à un bug). */}
        <Pressable
          onPress={() => setFlash((f) => nextFlashMode(f))}
          disabled={recording || facing === 'front'}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.a11yFlashMode.replace(
            '{label}',
            flash === 'on'
              ? t.news.compose.flashOn
              : flash === 'auto'
                ? t.news.compose.flashAuto
                : t.news.compose.flashOff,
          )}
          accessibilityState={{ selected: flash === 'on' }}
          style={({ pressed }) => [
            styles.roundButton,
            (recording || facing === 'front') && styles.roundButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-outline'}
            size={20}
            color={flash === 'on' ? postColors.optionMood : postColors.onMedia}
          />
        </Pressable>

        {/* Miroir : exclusivement en caméra frontale, une vue est à
            l'endroit quand on la regarde. */}
        {facing === 'front' ? (
          <Pressable
            onPress={() =>
              updatePreferences({ mirrorSelfie: !preferences.mirrorSelfie })
            }
            disabled={recording}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yMirrorSelfie}
            accessibilityState={{ selected: preferences.mirrorSelfie }}
            style={({ pressed }) => [
              styles.roundButton,
              recording && styles.roundButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={preferences.mirrorSelfie ? 'person' : 'person-outline'}
              size={20}
              color={
                preferences.mirrorSelfie ? postColors.optionMood : postColors.onMedia
              }
            />
          </Pressable>
        ) : null}

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
          timerDelay={timerDelay}
          onTimerDelayChange={setTimerDelay}
          showGrid={preferences.showGrid}
          onToggleGrid={() => updatePreferences({ showGrid: !preferences.showGrid })}
          videoQuality={preferences.videoQuality}
          onVideoQualityChange={(quality: VideoQualityOption) =>
            updatePreferences({ videoQuality: quality })
          }
          videoStabilization={preferences.videoStabilization}
          onToggleVideoStabilization={() =>
            updatePreferences({
              videoStabilization: !preferences.videoStabilization,
            })
          }
          maxDuration={maxDuration}
          onMaxDurationChange={setMaxDuration}
        />

        {segments.length > 0 ? (
          <View style={styles.segmentedControls}>
            <SegmentedProgressBar
              segments={segments}
              totalDurationMs={totalDurationMs}
              maxDurationMs={maxDuration * 1000}
              onRemoveLast={removeLastSegment}
            />
            <Pressable
              onPress={confirmRecording}
              disabled={isFinalizing || recording}
              accessibilityRole="button"
              accessibilityLabel={t.news.compose.a11yFinishRecording}
              style={({ pressed }) => [
                styles.confirmButton,
                (isFinalizing || recording) && styles.confirmButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.confirmButtonText}>
                {isFinalizing ? t.news.compose.finalizing : t.news.compose.finishRecording}
              </Text>
            </Pressable>
          </View>
        ) : null}

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

  segmentedControls: {
    gap: 10,
    paddingHorizontal: 16,
  },
  confirmButton: {
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: postColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: postColors.scrimHeavy,
  },
  confirmButtonText: {
    color: postColors.onMedia,
    fontWeight: '700',
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
