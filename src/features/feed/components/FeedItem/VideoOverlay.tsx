import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Animated, Dimensions, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface VideoOverlayProps {
  player: any
  onDoubleTapLike: () => void
  onLongPress?: () => void
}

export const VideoOverlay = memo(function VideoOverlay({ player, onDoubleTapLike, onLongPress }: VideoOverlayProps) {
  const { width: SCREEN_WIDTH } = Dimensions.get('window')

  const [isPlaying, setIsPlaying] = useState(true)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekInfo, setSeekInfo] = useState<{ label: string; x: number } | null>(null)

  const isPausedRef = useRef(false)
  const isSeekingRef = useRef(false)
  isSeekingRef.current = isSeeking
  const wasPlayingBeforeSeekRef = useRef(false)
  const progressValueRef = useRef(0)
  const barWidthRef = useRef(SCREEN_WIDTH)

  const [likeHeartOpacity] = useState(() => new Animated.Value(0))
  const [likeHeartScale] = useState(() => new Animated.Value(0.5))
  const [gesturePlayOpacity] = useState(() => new Animated.Value(0))
  const [gestureSeekLeftOpacity] = useState(() => new Animated.Value(0))
  const [gestureSeekRightOpacity] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (!player) return
    isPausedRef.current = !player.playing
    setIsPlaying(player.playing)
    const sub = player.addListener?.('playingChange', ({ isPlaying: next }: { isPlaying: boolean }) => {
      isPausedRef.current = !next
      setIsPlaying(next)
    })
    return () => sub?.remove?.()
  }, [player])

  const showLikeHeart = useCallback(() => {
    likeHeartOpacity.setValue(1)
    likeHeartScale.setValue(0.5)
    Animated.parallel([
      Animated.sequence([
        Animated.timing(likeHeartOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(likeHeartOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.spring(likeHeartScale, { toValue: 1.2, useNativeDriver: true, friction: 4 }),
    ]).start()
  }, [likeHeartOpacity, likeHeartScale])

  const showGestureIcon = useCallback((type: 'play' | 'seekLeft' | 'seekRight') => {
    const opac = type === 'seekLeft' ? gestureSeekLeftOpacity : type === 'seekRight' ? gestureSeekRightOpacity : gesturePlayOpacity
    opac.setValue(1)
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(opac, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start()
  }, [gesturePlayOpacity, gestureSeekLeftOpacity, gestureSeekRightOpacity])

  const togglePlay = useCallback(() => {
    if (!player) return
    try {
      setIsSeeking(false)
      if (isPausedRef.current) {
        player.play(); isPausedRef.current = false; setIsPlaying(true); setSeekInfo(null)
      } else {
        player.pause(); isPausedRef.current = true; setIsPlaying(false)
      }
      showGestureIcon('play')
    } catch {}
  }, [player, showGestureIcon])

  const longPressAction = useCallback(() => {
    if (!player) return
    try { player.pause() } catch {}
    isPausedRef.current = true
    onLongPress?.()
  }, [player, onLongPress])

  const lastTapRef = useRef(0)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const seekGestureTakenRef = useRef(false)

  const handleTouchStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = undefined
      longPressAction()
    }, 500)
  }, [longPressAction])

  const handleTouchEnd = useCallback(() => {
    if (seekGestureTakenRef.current) { seekGestureTakenRef.current = false; return }
    if (!longPressTimerRef.current) return
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = undefined
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      onDoubleTapLike()
      showLikeHeart()
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
      setTimeout(() => {
        if (lastTapRef.current !== 0 && Date.now() - lastTapRef.current >= 280) {
          lastTapRef.current = 0
          togglePlay()
        }
      }, 300)
    }
  }, [onDoubleTapLike, showLikeHeart, togglePlay])

  useEffect(() => () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current) }, [])

  return (
    <>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPressIn={handleTouchStart}
        onPressOut={handleTouchEnd}
      />

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', opacity: likeHeartOpacity }]}
      >
        <Animated.View style={{ transform: [{ scale: likeHeartScale }] }}>
          <Ionicons name="heart" size={110} color="#FF2D55" />
        </Animated.View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', opacity: gesturePlayOpacity }]}
      >
        <Ionicons name={isPlaying ? 'play' : 'pause'} size={80} color="rgba(255,255,255,0.85)" />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 60, opacity: gestureSeekLeftOpacity }]}
      >
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="play-back" size={44} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '700' }}>−5s</Text>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'flex-end', paddingRight: 60, opacity: gestureSeekRightOpacity }]}
      >
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="play-forward" size={44} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '700' }}>+5s</Text>
        </View>
      </Animated.View>
    </>
  )
})
