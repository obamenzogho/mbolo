/* src/features/news/components/compose/ComposeCamera.tsx

   Aperçu caméra du composeur.

   Reprend l'écran `app/(tabs)/(sub)/camera.tsx`, injoignable depuis la
   navigation, avec une différence qui compte : `mode` suit la bascule
   photo/vidéo au lieu d'être figé sur `video`. `takePictureAsync` sur une
   session vidéo rend des clichés dégradés — voire rien — sur Android.

   Le composant ne navigue pas : il remonte le média par `onCapture` et
   laisse l'orchestrateur décider de la suite. C'est ce qui permet de le
   monter dans un onglet plutôt que dans un écran séparé. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useIsFocused } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { captureException } from '@/lib/sentry'
import {
  CAMERA_DURATIONS,
  HIT_SLOP,
  postColors,
  postMotion,
  postRadius,
  postSpacing,
  postType,
} from '../../theme/postTokens'
import type { SelectedMedia } from '../../hooks/useComposeState'

type CaptureMode = 'photo' | 'video'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

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

  const [permission, requestPermission] = useCameraPermissions()
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo')
  const [facing, setFacing] = useState<'back' | 'front'>('back')
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [maxDuration, setMaxDuration] = useState<number>(CAMERA_DURATIONS[0])
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  /* Durée réelle côté logique : l'état ne sert qu'au rendu du compteur, et
     une closure de `startRecording` ne verrait pas sa valeur à jour. */
  const elapsedRef = useRef(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const stopRecording = useCallback(() => {
    if (!cameraRef.current || !recording) return
    /* `stopRecording` est ce qui résout la promesse de `recordAsync` :
       c'est là, et non ici, que le média est remonté. */
    cameraRef.current.stopRecording()
  }, [recording])

  /* Quitter l'onglet pendant l'enregistrement démonte la `CameraView` :
     sans arrêt explicite, le fichier reste ouvert et la promesse pendante. */
  useEffect(() => {
    if (!isFocused && recording) stopRecording()
  }, [isFocused, recording, stopRecording])

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
        /* `recordAsync` ne remonte pas la durée : c'est le compteur local,
           aiguillé au moment de l'arrêt, qui fait foi. */
        onCapture({
          uri: video.uri,
          type: 'video',
          duration: Math.max(1, elapsedRef.current),
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
  }, [recording, maxDuration, onCapture, clearTimer])

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

  const handleShutter = useCallback(() => {
    if (captureMode === 'photo') {
      takePhoto()
      return
    }
    if (recording) stopRecording()
    else startRecording()
  }, [captureMode, recording, takePhoto, startRecording, stopRecording])

  const handleSwitchMode = useCallback((next: CaptureMode) => {
    if (recording) return
    setCaptureMode(next)
  }, [recording])

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
      {isFocused && permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode={captureMode === 'video' ? 'video' : 'picture'}
          flash={flash}
        />
      ) : null}

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
      </View>

      <View style={styles.bottomBar}>
        {captureMode === 'video' ? (
          <View style={styles.durations}>
            {CAMERA_DURATIONS.map((duration) => (
              <Pressable
                key={duration}
                onPress={() => setMaxDuration(duration)}
                hitSlop={HIT_SLOP}
                disabled={recording}
                accessibilityRole="button"
                accessibilityState={{ selected: maxDuration === duration }}
                style={({ pressed }) => [styles.duration, pressed && styles.pressed]}
              >
                <Text
                  style={[
                    styles.durationText,
                    maxDuration === duration && styles.durationTextOn,
                  ]}
                >
                  {`${duration}s`}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
            accessibilityRole="button"
            accessibilityLabel={
              captureMode === 'photo' ? t.news.compose.a11yShutter : t.news.compose.a11yRecord
            }
            style={({ pressed }) => [styles.shutterOuter, pressed && styles.pressed]}
          >
            <View style={[styles.shutterInner, recording && styles.shutterRecording]} />
          </Pressable>

          {/* Espaceur : garde le déclencheur centré sans le décaler
              quand le bouton de flip est seul de son côté. */}
          <View style={styles.roundButton} />
        </View>

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
  durations: { flexDirection: 'row', justifyContent: 'center', gap: postSpacing.inlineGap },
  duration: { paddingVertical: 5, paddingHorizontal: 12 },
  durationText: { color: postColors.textTertiary, ...postType.composeTab },
  durationTextOn: { color: postColors.onMedia },

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
  /* Le carré est la convention universelle du « appuyer pour arrêter ». */
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
