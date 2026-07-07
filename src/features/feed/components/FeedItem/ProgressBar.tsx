import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ProgressBarProps {
  player: any
  bottomOffset?: number
}

export const ProgressBar = memo(function ProgressBar({ player, bottomOffset = 65 }: ProgressBarProps) {
  const insets = useSafeAreaInsets()
  const { width: SCREEN_WIDTH } = useWindowDimensions()

  const [isPlaying, setIsPlaying] = useState(true)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekInfo, setSeekInfo] = useState<{ label: string; x: number } | null>(null)

  const [progressAnim] = useState(() => new Animated.Value(0))
  const [barOpacity] = useState(() => new Animated.Value(1))
  const progressValueRef = useRef(0)
  const barWidthRef = useRef(SCREEN_WIDTH)
  const isSeekingRef = useRef(false)
  isSeekingRef.current = isSeeking
  const wasPlayingBeforeSeekRef = useRef(false)
  const seekGestureTakenRef = useRef(false)

  const setProgress = useCallback((ratio: number) => {
    const r = Math.max(0, Math.min(1, ratio))
    progressValueRef.current = r
    try { progressAnim.setValue(r) } catch {}
  }, [progressAnim])

  useEffect(() => {
    if (!player) { setProgress(0); return }
    setIsPlaying(player.playing)
    player.timeUpdateEventInterval = 0.1
    const subs = [
      player.addListener('timeUpdate', ({ currentTime }: { currentTime: number }) => {
        if (isSeekingRef.current) return
        const dur = player.duration
        if (dur && dur > 0) setProgress(currentTime / dur)
      }),
      player.addListener('playingChange', ({ isPlaying: next }: { isPlaying: boolean }) => setIsPlaying(next)),
      player.addListener('sourceChange', () => setProgress(0)),
    ]
    return () => {
      subs.forEach((s) => s.remove())
      try { player.timeUpdateEventInterval = 0 } catch {}
      setProgress(0)
    }
  }, [player, setProgress])

  useEffect(() => {
    if (isPlaying && !isSeeking) {
      const t = setTimeout(() => {
        Animated.timing(barOpacity, { toValue: 0.3, duration: 500, useNativeDriver: true }).start()
      }, 1500)
      return () => clearTimeout(t)
    }
    barOpacity.setValue(1)
  }, [isPlaying, isSeeking, barOpacity])

  const seekBegin = useCallback(() => {
    isSeekingRef.current = true
    setIsSeeking(true)
    wasPlayingBeforeSeekRef.current = player?.playing ?? false
    barOpacity.setValue(1)
    if (player?.playing) { try { player.pause() } catch {} }
  }, [player, barOpacity])

  const seekUpdate = useCallback((ratio: number) => {
    if (!player) return
    const dur = player.duration
    if (!dur || dur <= 0) return
    setProgress(ratio)
    const totalSecs = Math.round(ratio * dur)
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    setSeekInfo({ label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, x: ratio * barWidthRef.current })
  }, [player, setProgress])

  const seekEnd = useCallback(() => {
    isSeekingRef.current = false
    setIsSeeking(false)
    setSeekInfo(null)
    if (player) {
      try {
        const dur = player.duration
        if (dur && dur > 0) player.currentTime = progressValueRef.current * dur
        if (wasPlayingBeforeSeekRef.current) { player.play(); setIsPlaying(true) }
      } catch {}
    }
  }, [player])

  const seekBeginRef = useRef(seekBegin); seekBeginRef.current = seekBegin
  const seekUpdateRef = useRef(seekUpdate); seekUpdateRef.current = seekUpdate
  const seekEndRef = useRef(seekEnd); seekEndRef.current = seekEnd

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        if (Math.abs(g.dx) > 5) { seekGestureTakenRef.current = true; return true }
        return false
      },
      onPanResponderGrant: (evt) => {
        seekBeginRef.current()
        const locX = evt.nativeEvent?.locationX ?? 0
        seekUpdateRef.current(Math.max(0, Math.min(1, locX / barWidthRef.current)))
      },
      onPanResponderMove: (_, g) => {
        seekUpdateRef.current(Math.max(0, Math.min(1, g.moveX / barWidthRef.current)))
      },
      onPanResponderRelease: () => { seekGestureTakenRef.current = false; seekEndRef.current() },
      onPanResponderTerminate: () => { seekGestureTakenRef.current = false; seekEndRef.current() },
    }),
  ).current

  if (!player) return null

  return (
    <Animated.View
      {...panResponder.panHandlers}
      onLayout={(e) => { barWidthRef.current = e.nativeEvent.layout.width }}
      style={[styles.container, { bottom: bottomOffset + insets.bottom, opacity: barOpacity }]}
    >
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </View>

      {(!isPlaying || isSeeking) && (
        <>
          <Animated.View
            style={[styles.thumb, {
              left: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [16, SCREEN_WIDTH - 16] }),
            }]}
          />
          {seekInfo && (
            <View style={[styles.timeLabel, { left: Math.max(20, Math.min(seekInfo.x, SCREEN_WIDTH - 60)) }]}>
              <Text style={styles.timeText}>{seekInfo.label}</Text>
            </View>
          )}
        </>
      )}
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, height: 60, justifyContent: 'flex-end' },
  track: { height: 3, marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3 },
  fill: { height: '100%', backgroundColor: '#00C853', borderRadius: 3 },
  thumb: {
    position: 'absolute', bottom: 60 / 2 - 8, width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#00C853', borderWidth: 2, borderColor: '#FFF', transform: [{ translateX: -8 }],
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2,
  },
  timeLabel: {
    position: 'absolute', bottom: 34, backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  timeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
})
