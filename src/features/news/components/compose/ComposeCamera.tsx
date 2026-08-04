/* src/features/news/components/compose/ComposeCamera.tsx

   Caméra studio (style TikTok).

   Fonctionnalités :
   - Photo / vidéo (toggle mode)
   - Flash (on/off)
   - Switch caméra avant/arrière
   - Timer (none, 3s, 10s)
   - Zoom pince (pinch-to-zoom)
   - Grid of thirds
   - Ratio d'aspect (9:16, 1:1, 4:5, 16:9, Original)
   - Mode rafale (burst, photo uniquement)
   - Vitesse de capture vidéo (0.3x → 3x)
   - Pause/reprise vidéo
   - Barre d'outils avec sélection ratio, vitesse, durée, grid

   Le composant ne navigue pas : il remonte le média par `onCapture` et
   laisse l'orchestrateur décider de la suite. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
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
import { CameraOverlay } from '@/features/create/components/camera/CameraOverlay'
import { CameraToolbar } from '@/features/create/components/camera/CameraToolbar'

type CaptureMode = 'photo' | 'video'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const BURST_INTERVAL_MS = 150
const BURST_LIMIT = 10
const MAX_ZOOM = 10
const MIN_ZOOM = 0.5

interface ComposeCameraProps {
  onCapture: (media: SelectedMedia) => void
  /* Décalage horizontal du topBar pour laisser de la place à un bouton
     overlay (ex. bouton retour dans SelectScreen). */
  topBarInset?: number
}

export function ComposeCamera({ onCapture, topBarInset }: ComposeCameraProps) {
  const { t } = useI18n()
  const isFocused = useIsFocused()
  const cameraRef = useRef<CameraView>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const burstRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [permission, requestPermission] = useCameraPermissions()
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo')
  const [facing, setFacing] = useState<'back' | 'front'>('back')
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [maxDuration, setMaxDuration] = useState<number>(30)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)

  /* ── Nouvel état caméra studio ─────────────────────────────────── */
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(false)
  const [aspectRatio, setAspectRatio] = useState<AspectRatioValue>('9:16')
  const [captureSpeed, setCaptureSpeed] = useState<CaptureSpeed>('1')
  const [isBursting, setIsBursting] = useState(false)
  const [burstCount, setBurstCount] = useState(0)
  const burstCountRef = useRef(0)

  /* ── Timer enregistrement ─────────────────────────────────────── */
  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  /* ── Zoom geste pince ─────────────────────────────────────────── */
  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          setZoom((prev) => {
            const next = prev * e.scale
            return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
          })
        })
        .onEnd(() => {}),
    [],
  )

  /* Double-tap = reset zoom */
  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
          setZoom(1)
        }),
    [],
  )

  const composedGestures = Gesture.Race(doubleTapGesture, pinchGesture)

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
        onCapture({
          uri: video.uri,
          type: 'video',
          duration: Math.max(1, elapsedRef.current),
          captureSpeed,
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
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
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
  const startBurst = useCallback(() => {
    if (captureMode !== 'photo' || isBursting) return
    setIsBursting(true)
    burstCountRef.current = 0
    setBurstCount(0)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    burstRef.current = setInterval(() => {
      if (burstCountRef.current >= BURST_LIMIT) {
        stopBurst()
        return
      }
      if (!cameraRef.current) return
      cameraRef.current.takePictureAsync({ quality: 0.8 }).then((photo) => {
        if (photo?.uri) {
          onCapture({
            uri: photo.uri,
            type: 'image',
            width: photo.width,
            height: photo.height,
          })
        }
      }).catch(() => {})
      burstCountRef.current += 1
      setBurstCount(burstCountRef.current)
    }, BURST_INTERVAL_MS)
  }, [captureMode, isBursting, onCapture])

  const stopBurst = useCallback(() => {
    if (burstRef.current) {
      clearInterval(burstRef.current)
      burstRef.current = null
    }
    setIsBursting(false)
    setBurstCount(0)
    burstCountRef.current = 0
  }, [])

  useEffect(() => {
    return () => {
      if (burstRef.current) clearInterval(burstRef.current)
    }
  }, [])

  /* ── Shutter handler ──────────────────────────────────────────── */
  const handleShutter = useCallback(() => {
    if (captureMode === 'photo') {
      if (isBursting) {
        stopBurst()
      } else {
        takePhoto()
      }
      return
    }
    if (recording) stopRecording()
    else startRecording()
  }, [captureMode, recording, isBursting, takePhoto, startRecording, stopRecording, stopBurst])

  const handleLongPress = useCallback(() => {
    if (captureMode === 'photo' && !isBursting) {
      startBurst()
    }
  }, [captureMode, isBursting, startBurst])

  const handlePressOut = useCallback(() => {
    if (isBursting) {
      stopBurst()
    }
  }, [isBursting, stopBurst])

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
      {/* ── CameraView + gesture zoom ──────────────────────────────── */}
      <GestureDetector gesture={composedGestures}>
        <View style={StyleSheet.absoluteFill}>
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
        </View>
      </GestureDetector>

      {/* ── Overlays (grid, ratio mask, zoom indicator) ────────────── */}
      <CameraOverlay
        showGrid={showGrid}
        aspectRatio={aspectRatio}
        zoom={zoom}
        showZoomIndicator
      />

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
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yFlipCamera}
            style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          >
            <Ionicons name="camera-reverse" size={24} color={postColors.onMedia} />
          </Pressable>

          <Pressable
            onPress={handleShutter}
            onLongPress={handleLongPress}
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
