import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Dimensions, Alert, Modal, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  VideoFile,
} from 'react-native-vision-camera'
import { PinchGestureHandler, State } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated'
import { colors } from '../../src/lib/theme'
import { FILTERS, FilterName } from '../../src/hooks/useCamera'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

const RADIUS = 42
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export default function CameraScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission()
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission()

  const [facing, setFacing] = useState<'front' | 'back'>('back')
  const frontDevice = useCameraDevice('front')
  const backDevice = useCameraDevice('back')
  const device = facing === 'back' ? backDevice : frontDevice

  const cameraRef = useRef<Camera>(null)
  const flipAnim = useSharedValue(0)
  const focusAnim = useSharedValue(1)
  const countScale = useSharedValue(1)
  const countOpacity = useSharedValue(1)
  const progress = useSharedValue(0)
  const innerScale = useSharedValue(1)

  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [torch, setTorch] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [maxDuration, setMaxDuration] = useState(15)
  const [activeTab, setActiveTab] = useState('15s')
  const [timer, setTimer] = useState<number | null>(null)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showTimerOptions, setShowTimerOptions] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterName>('Normal')
  const [beautyIntensity, setBeautyIntensity] = useState(0)
  const [showBeauty, setShowBeauty] = useState(false)
  const [lastMediaUri, setLastMediaUri] = useState<string | null>(null)
  const [showBlink, setShowBlink] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null)
  const [permissionReady, setPermissionReady] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const blinkRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pressStartRef = useRef<number>(0)
  const recordingStartedRef = useRef(false)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const flipStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(flipAnim.value, [0, 0.5, 1], [1, 0, 1]) }],
  }))

  const focusAnimatedStyle = useAnimatedStyle(() => ({
    opacity: focusAnim.value,
    transform: [{ scale: focusAnim.value }],
  }))

  const countdownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
    opacity: countOpacity.value,
  }))

  const innerCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }))

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(progress.value, [0, 1], [CIRCUMFERENCE, 0]),
  }))

  useEffect(() => {
    const init = async () => {
      if (!hasCameraPermission) {
        const granted = await requestCameraPermission()
        if (!granted) return
      }
      if (!hasMicPermission) {
        const granted = await requestMicPermission()
        if (!granted) return
      }
      setPermissionReady(true)
    }
    init()
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (blinkRef.current) clearInterval(blinkRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    if (isRecording && maxDuration - recordingTime <= 3 && maxDuration - recordingTime > 0) {
      blinkRef.current = setInterval(() => {
        setShowBlink(prev => !prev)
      }, 500)
    } else {
      if (blinkRef.current) clearInterval(blinkRef.current)
      setShowBlink(false)
    }
  }, [isRecording, recordingTime, maxDuration])

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const getRemainingTime = (): number => Math.max(0, maxDuration - recordingTime)

  const animateCount = useCallback(() => {
    countScale.value = withSequence(
      withTiming(1.5, { duration: 200 }),
      withTiming(1, { duration: 600 })
    )
    countOpacity.value = withSequence(
      withTiming(0.3, { duration: 200 }),
      withTiming(1, { duration: 600 })
    )
  }, [])

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || recordingStartedRef.current) return
    recordingStartedRef.current = true

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    setIsRecording(true)
    setRecordingTime(0)

    innerScale.value = withSpring(0.7, { friction: 6 })
    progress.value = withTiming(1, { duration: maxDuration * 1000, easing: Easing.linear })

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= maxDuration) return prev
        return prev + 1
      })
    }, 1000)

    try {
      await cameraRef.current.startRecording({
        onRecordingFinished: (video: VideoFile) => {
          setLastMediaUri(video.path)
          router.push({
            pathname: '/(tabs)/video-editor',
            params: { mediaUri: video.path, mediaType: 'video' },
          })
        },
        onRecordingError: () => {
          resetRecordingState()
        },
      })
    } catch {
      resetRecordingState()
    }
  }, [maxDuration, router])

  const stopRecording = useCallback(async () => {
    if (!recordingStartedRef.current) return
    recordingStartedRef.current = false

    if (timerRef.current) clearInterval(timerRef.current)
    if (blinkRef.current) clearInterval(blinkRef.current)

    try {
      await cameraRef.current.stopRecording()
    } catch {}

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    innerScale.value = withSpring(1, { friction: 6 })
    progress.value = withTiming(0, { duration: 200 })
    setIsRecording(false)
    setRecordingTime(0)
    setShowBlink(false)
  }, [])

  const resetRecordingState = () => {
    recordingStartedRef.current = false
    if (timerRef.current) clearInterval(timerRef.current)
    if (blinkRef.current) clearInterval(blinkRef.current)
    progress.value = withTiming(0, { duration: 200 })
    innerScale.value = withSpring(1, { friction: 6 })
    setIsRecording(false)
    setRecordingTime(0)
    setShowBlink(false)
  }

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'quality',
        flash: 'off',
      })
      setLastMediaUri(photo.path)
      router.push({
        pathname: '/(tabs)/video-editor',
        params: { mediaUri: photo.path, mediaType: 'photo' },
      })
    } catch {}
  }, [router])

  const onHandlerStateChange = useCallback(({ nativeEvent }: { nativeEvent: any }) => {
    if (nativeEvent.state === State.ACTIVE) {
      pressStartRef.current = Date.now()
      startRecording()
    }
    if (nativeEvent.state === State.END || nativeEvent.state === State.CANCELLED) {
      const pressDuration = Date.now() - pressStartRef.current
      if (pressDuration < 300 && !recordingStartedRef.current) {
        takePhoto()
      } else if (recordingStartedRef.current) {
        stopRecording()
      }
    }
  }, [startRecording, stopRecording, takePhoto])

  const startWithTimer = useCallback((seconds: number) => {
    setShowTimerOptions(false)
    setIsCountingDown(true)
    setTimer(seconds)
    animateCount()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    let count = seconds - 1
    countdownIntervalRef.current = setInterval(() => {
      if (count <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
        setIsCountingDown(false)
        setTimer(null)
        startRecording()
      } else {
        setTimer(count)
        animateCount()
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        count--
      }
    }, 1000)
  }, [startRecording, animateCount])

  const cancelCountdown = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setIsCountingDown(false)
    setTimer(null)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const flipCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    flipAnim.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 150 })
    )
    setTimeout(() => setFacing(f => f === 'back' ? 'front' : 'back'), 150)
  }, [flipAnim])

  const onPinchEvent = useCallback((event: any) => {
    const scale = event.nativeEvent.scale
    setZoom(prev => Math.min(Math.max(1 + (scale - 1) * 0.5, 1), 8))
  }, [])

  const onPinchHandlerStateChange = useCallback(() => {
    setZoom(1)
  }, [])

  const onTapFocus = useCallback((event: any) => {
    if (!cameraRef.current) return
    const { locationX, locationY } = event.nativeEvent
    const x = locationX / SCREEN_WIDTH
    const y = locationY / SCREEN_HEIGHT
    setFocusPoint({ x, y })
    try {
      cameraRef.current.setFocusPoint({ x, y })
    } catch {}
    focusAnim.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withTiming(1, { duration: 200 }),
      withDelay(800, withTiming(0, { duration: 200 }))
    )
    setTimeout(() => setFocusPoint(null), 1300)
  }, [])

  const openGallery = useCallback(() => {
    router.push('/(tabs)/upload')
  }, [router])

  const toggleTorch = useCallback(() => {
    setTorch(prev => !prev)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const getDurationFromTab = (tab: string): number => {
    switch (tab) {
      case '15s': return 15
      case '60s': return 60
      case '3min': return 180
      case 'Photo': return 0
      default: return 15
    }
  }

  if (!permissionReady || !device) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-outline" size={64} color="#555" />
        <Text style={styles.permissionTitle}>Accès à la caméra</Text>
        <Text style={styles.permissionText}>
          Mbolo a besoin de ta caméra et de ton micro pour créer des reels.
        </Text>
        <TouchableOpacity onPress={async () => {
          await requestCameraPermission()
          await requestMicPermission()
          setPermissionReady(true)
        }} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Autoriser</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#888', fontSize: 14 }}>Annuler</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <PinchGestureHandler onGestureEvent={onPinchEvent} onHandlerStateChange={onPinchHandlerStateChange}>
        <Animated.View style={{ flex: 1 }} onTouchEnd={onTapFocus}>
          <Animated.View style={[{ flex: 1 }, flipStyle]}>
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={true}
              video={activeTab !== 'Photo'}
              photo={true}
              torch={torch ? 'on' : 'off'}
              zoom={zoom}
              enableZoomGesture={false}
            />
          </Animated.View>

          {focusPoint && (
            <Animated.View style={[{
              position: 'absolute',
              left: focusPoint.x * SCREEN_WIDTH - 35,
              top: focusPoint.y * SCREEN_HEIGHT - 35,
              width: 70, height: 70,
              borderWidth: 2, borderColor: '#fff',
              backgroundColor: 'transparent',
            }, focusAnimatedStyle]}>
              <View style={{ position: 'absolute', top: -1, left: -1, width: 16, height: 16, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff' }} />
              <View style={{ position: 'absolute', top: -1, right: -1, width: 16, height: 16, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#fff' }} />
              <View style={{ position: 'absolute', bottom: -1, left: -1, width: 16, height: 16, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#fff' }} />
              <View style={{ position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#fff' }} />
            </Animated.View>
          )}
        </Animated.View>
      </PinchGestureHandler>

      {isCountingDown && timer !== null && timer > 0 && (
        <TouchableOpacity activeOpacity={1} onPress={cancelCountdown} style={styles.countdownOverlay}>
          <TouchableOpacity onPress={cancelCountdown} style={styles.cancelButton}>
            <Ionicons name="close" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, marginLeft: 4 }}>Annuler</Text>
          </TouchableOpacity>
          <Animated.View style={countdownStyle}>
            <Text style={styles.countdownText}>{timer}</Text>
          </Animated.View>
        </TouchableOpacity>
      )}

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          {zoom > 1.05 && (
            <View style={styles.zoomIndicator}>
              <Text style={styles.zoomText}>{zoom.toFixed(1)}x</Text>
            </View>
          )}
          <TouchableOpacity onPress={toggleTorch} style={styles.topButton}>
            <Ionicons name={torch ? 'flash' : 'flash-off'} size={24} color={torch ? '#FCD116' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowTimerOptions(true)} style={styles.topButton}>
            <Ionicons name="timer-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {isRecording && (
        <View style={styles.recordingTimer}>
          <View style={[styles.redDot, showBlink && { opacity: 0.2 }]} />
          <Text style={styles.chronoText}>{formatTime(getRemainingTime())}</Text>
        </View>
      )}

      <View style={styles.rightControls}>
        <TouchableOpacity onPress={flipCamera} style={styles.rightButton}>
          <Ionicons name="camera-reverse" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.rightButton}>
          <Ionicons name="color-filter" size={26} color={activeFilter !== 'Normal' ? colors.accent : '#fff'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowBeauty(true)} style={styles.rightButton}>
          <Ionicons name="sparkles" size={26} color={beautyIntensity > 0 ? colors.accent : '#fff'} />
        </TouchableOpacity>
      </View>

      <View style={[styles.bottomArea, { paddingBottom: 32 + insets.bottom }]}>
        <View style={styles.durationTabs}>
          {['15s', '60s', '3min', 'Photo'].map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                setActiveTab(tab)
                setMaxDuration(getDurationFromTab(tab))
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              }}
              style={styles.tabItem}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabActive]}>{tab}</Text>
              {activeTab === tab && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.recordRow}>
          <TouchableOpacity onPress={openGallery} style={styles.galleryButton}>
            {lastMediaUri ? (
              <Image source={{ uri: lastMediaUri }} style={styles.galleryThumb} />
            ) : (
              <Ionicons name="image" size={24} color="#888" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPressIn={() => { pressStartRef.current = Date.now(); startRecording() }}
            onPressOut={() => {
              const pressDuration = Date.now() - pressStartRef.current
              if (pressDuration < 300 && !recordingStartedRef.current) {
                takePhoto()
              } else if (recordingStartedRef.current) {
                stopRecording()
              }
            }}
            style={styles.recordContainer}
          >
            <Svg width={100} height={100}>
              <Circle cx={50} cy={50} r={RADIUS} stroke="#333" strokeWidth={4} fill="transparent" />
              <AnimatedCircle
                cx={50} cy={50} r={RADIUS}
                stroke="#00A86B" strokeWidth={4} fill="transparent"
                strokeDasharray={CIRCUMFERENCE}
                animatedProps={progressProps}
                strokeLinecap="round"
                rotation="-90"
                origin="50, 50"
              />
            </Svg>
            <Animated.View style={[styles.innerCircle, innerCircleStyle, { backgroundColor: isRecording ? '#FF0000' : '#FFFFFF' }]} />
          </TouchableOpacity>

          <View style={{ width: 48 }} />
        </View>
      </View>

      <Modal visible={showFilters} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filtres</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 20 }}>
              {FILTERS.map(filter => (
                <TouchableOpacity key={filter.name} onPress={() => { setActiveFilter(filter.name); setShowFilters(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }} style={{ alignItems: 'center' }}>
                  <View style={[styles.filterPreview, activeFilter === filter.name && styles.filterPreviewActive]}>
                    <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>{filter.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowFilters(false)} style={styles.modalClose}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTimerOptions} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={() => setShowTimerOptions(false)} style={styles.modalOverlay}>
          <View style={styles.timerModalContent}>
            <Text style={styles.modalTitle}>Minuteur</Text>
            <TouchableOpacity onPress={() => { setShowTimerOptions(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }} style={styles.timerOption}>
              <Text style={{ color: '#888', fontSize: 16 }}>Off</Text>
            </TouchableOpacity>
            {[3, 10].map(sec => (
              <TouchableOpacity key={sec} onPress={() => startWithTimer(sec)} style={styles.timerOption}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{sec}s</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showBeauty} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Beauté</Text>
            <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#888', fontSize: 13 }}>Intensité</Text>
                <Text style={{ color: '#fff', fontSize: 13 }}>{Math.round(beautyIntensity * 100)}%</Text>
              </View>
              <View style={{ height: 4, backgroundColor: '#333', borderRadius: 2 }}>
                <View style={{ height: '100%', width: `${beautyIntensity * 100}%`, backgroundColor: colors.accent, borderRadius: 2 }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                {[0, 0.25, 0.5, 0.75, 1].map(val => (
                  <TouchableOpacity key={val} onPress={() => { setBeautyIntensity(val); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: beautyIntensity === val ? colors.accent : '#333', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{Math.round(val * 100)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowBeauty(false)} style={styles.modalClose}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 24 },
  permissionText: { color: '#888', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  permissionButton: { marginTop: 24, backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 25 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  topBar: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, zIndex: 10 },
  topButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  zoomIndicator: { backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  zoomText: { color: '#fff', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  recordingTimer: { position: 'absolute', top: 100, left: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, zIndex: 10 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF0000', marginRight: 6 },
  chronoText: { color: '#fff', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rightControls: { position: 'absolute', right: 12, top: '30%', zIndex: 10 },
  rightButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  durationTabs: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24, gap: 4 },
  tabItem: { paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' },
  tabText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
  tabActive: { color: '#fff', fontWeight: '700' },
  tabIndicator: { width: 20, height: 2, backgroundColor: '#fff', borderRadius: 1, marginTop: 4 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40 },
  galleryButton: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#444' },
  galleryThumb: { width: '100%', height: '100%' },
  recordContainer: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center' },
  innerCircle: { position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFFFFF' },
  countdownOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 25 },
  cancelButton: { position: 'absolute', top: 60, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  countdownText: { color: '#fff', fontSize: 120, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20, paddingBottom: 40 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  modalClose: { paddingVertical: 16, alignItems: 'center', borderTopWidth: 0.5, borderTopColor: '#333', marginTop: 16, marginHorizontal: 20 },
  filterPreview: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  filterPreviewActive: { borderColor: colors.accent },
  timerModalContent: { backgroundColor: '#1a1a1a', marginHorizontal: 40, borderRadius: 16, padding: 20, alignItems: 'center' },
  timerOption: { paddingVertical: 16, width: '100%', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#333' },
})