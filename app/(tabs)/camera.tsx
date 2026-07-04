/* CameraScreen — écran caméra avec expo-camera (Expo Go compatible).
   Interface TikTok-like : enregistrement vidéo, photo, flip, flash, timer. */

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useIsFocused } from '@react-navigation/native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated'
import { colors } from '../../src/lib/theme'
import { BackButton } from '../../src/components/ui/BackButton'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

export default function CameraScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  const cameraRef = useRef<CameraView>(null)

  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<'back' | 'front'>('back')
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [maxDuration, setMaxDuration] = useState(60)
  const [showBlink, setShowBlink] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const blinkRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progress = useSharedValue(0)
  const innerScale = useSharedValue(1)

  const progressAnim = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }))

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (blinkRef.current) clearInterval(blinkRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isFocused && isRecording) stopRecording()
  }, [isFocused])

  useEffect(() => {
    if (isRecording && recordingTime >= maxDuration - 3 && recordingTime < maxDuration) {
      blinkRef.current = setInterval(() => setShowBlink(prev => !prev), 500)
    } else {
      if (blinkRef.current) clearInterval(blinkRef.current)
      setShowBlink(false)
    }
  }, [isRecording, recordingTime, maxDuration])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) return
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      setIsRecording(true)
      setRecordingTime(0)
      innerScale.value = withTiming(0.7, { duration: 200 })
      progress.value = withTiming(1, { duration: maxDuration * 1000, easing: Easing.linear })

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration) return prev
          return prev + 1
        })
      }, 1000)

      const video = await cameraRef.current.recordAsync()
      if (video?.uri) {
        router.push({
          pathname: '/(tabs)/video-editor',
          params: { mediaUri: video.uri, mediaType: 'video' },
        })
      }
    } catch {
      resetRecordingState()
    }
  }, [isRecording, maxDuration, router, innerScale, progress])

  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return
    try {
      cameraRef.current.stopRecording()
    } catch {}
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    innerScale.value = withTiming(1, { duration: 200 })
    progress.value = withTiming(0, { duration: 200 })
    setIsRecording(false)
    setRecordingTime(0)
    setShowBlink(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (blinkRef.current) clearInterval(blinkRef.current)
  }, [isRecording, innerScale, progress])

  const resetRecordingState = () => {
    innerScale.value = withTiming(1, { duration: 200 })
    progress.value = withTiming(0, { duration: 200 })
    setIsRecording(false)
    setRecordingTime(0)
    setShowBlink(false)
    if (timerRef.current) clearInterval(timerRef.current)
    if (blinkRef.current) clearInterval(blinkRef.current)
  }

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
      if (photo?.uri) {
        router.push({
          pathname: '/(tabs)/video-editor',
          params: { mediaUri: photo.uri, mediaType: 'photo' },
        })
      }
    } catch {}
  }, [router])

  const flipCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setFacing(f => f === 'back' ? 'front' : 'back')
  }, [])

  const toggleFlash = useCallback(() => {
    setFlash(f => f === 'off' ? 'on' : 'off')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const handleRecordPress = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  const getRemainingTime = () => Math.max(0, maxDuration - recordingTime)

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#fff' }}>Chargement...</Text>
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-outline" size={64} color="#555" />
        <Text style={styles.permissionTitle}>Accès à la caméra</Text>
        <Text style={styles.permissionText}>
          Mbolo a besoin de ta caméra pour créer des reels.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Autoriser</Text>
        </TouchableOpacity>
        <BackButton fallbackRoute="/(tabs)/feed" style={{ marginTop: 24 }} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {isFocused && permission?.granted && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
          flash={flash}
        />
      )}

      {/* TOP BAR */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <BackButton fallbackRoute="/(tabs)/feed" style={styles.topButton} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={toggleFlash} style={styles.topButton}>
            <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={24} color={flash === 'on' ? '#FCD116' : '#fff'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* RECORDING TIMER */}
      {isRecording && (
        <View style={[styles.recordingTimer, { top: insets.top + 60 }]}>
          <View style={[styles.redDot, showBlink && { opacity: 0.2 }]} />
          <Text style={styles.timerText}>{formatTime(getRemainingTime())}</Text>
        </View>
      )}

      {/* BOTTOM CONTROLS */}
      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 20 }]}>
        {/* Duration selector */}
        <View style={styles.durationTabs}>
          {[15, 30, 60].map(dur => (
            <TouchableOpacity
              key={dur}
              onPress={() => { setMaxDuration(dur); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }}
              style={styles.tabItem}
            >
              <Text style={[styles.tabText, maxDuration === dur && styles.tabActive]}>
                {dur}s
              </Text>
              {maxDuration === dur && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Record row */}
        <View style={styles.recordRow}>
          {/* Flip */}
          <TouchableOpacity onPress={flipCamera} style={styles.sideButton}>
            <Ionicons name="camera-reverse" size={30} color="#fff" />
          </TouchableOpacity>

          {/* Record button */}
          <TouchableOpacity onPress={handleRecordPress} style={styles.recordContainer}>
            <View style={styles.recordOuter}>
              <Animated.View
                style={[
                  styles.recordInner,
                  progressAnim,
                  { backgroundColor: isRecording ? '#FF0000' : '#FFFFFF' },
                ]}
              />
            </View>
          </TouchableOpacity>

          {/* Photo */}
          <TouchableOpacity onPress={takePhoto} style={styles.sideButton}>
            <Ionicons name="camera" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  permissionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 24 },
  permissionText: { color: '#888', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  permissionButton: { marginTop: 24, backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 25 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 10,
  },
  topButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  recordingTimer: {
    position: 'absolute', left: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, zIndex: 10,
  },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF0000', marginRight: 6 },
  timerText: { color: '#fff', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  durationTabs: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24, gap: 4 },
  tabItem: { paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  tabText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  tabActive: { color: '#fff', fontWeight: '700' },
  tabIndicator: { width: 20, height: 2, backgroundColor: '#fff', borderRadius: 1, marginTop: 4 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 40 },
  sideButton: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  recordContainer: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  recordOuter: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center',
  },
  recordInner: { width: 60, height: 60, borderRadius: 30 },
})
