import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ProgressBarProps {
  player: any
  bottomOffset?: number
  translateY?: Animated.Value
}

export const ProgressBar = memo(function ProgressBar({ player, bottomOffset = 65, translateY }: ProgressBarProps) {
  const insets = useSafeAreaInsets()
  const { width: SCREEN_WIDTH } = useWindowDimensions()

  // La track est en retrait de PAD de chaque côté : les calculs de seek et la
  // position de la pastille doivent en tenir compte, sinon le doigt et la
  // position réelle sont décalés (bug « seek imprécis »).
  const PAD = 16

  const [isPlaying, setIsPlaying] = useState(true)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekInfo, setSeekInfo] = useState<{ label: string; x: number } | null>(null)

  const [progressAnim] = useState(() => new Animated.Value(0))
  const [barOpacity] = useState(() => new Animated.Value(1))
  const [activeAnim] = useState(() => new Animated.Value(0)) // 0 = fine, 1 = épaissie (scrub)
  const progressValueRef = useRef(0)
  const barWidthRef = useRef(SCREEN_WIDTH)
  const lastSeekApplyRef = useRef(0)
  const isSeekingRef = useRef(false)
  isSeekingRef.current = isSeeking
  const seekGestureTakenRef = useRef(false)

  // Convertit une coordonnée X (dans le conteneur pleine largeur) en ratio 0..1
  // borné à la zone utile de la track.
  const xToRatio = useCallback((x: number) => {
    const usable = Math.max(1, barWidthRef.current - PAD * 2)
    return Math.max(0, Math.min(1, (x - PAD) / usable))
  }, [])

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
    barOpacity.setValue(1)
    // Façon Facebook : la barre s'épaissit au toucher. La vidéo continue de
    // jouer pendant le scrub (pas de pause).
    Animated.timing(activeAnim, { toValue: 1, duration: 120, useNativeDriver: false }).start()
  }, [barOpacity, activeAnim])

  const seekUpdate = useCallback((ratio: number) => {
    if (!player) return
    const dur = player.duration
    if (!dur || dur <= 0) return
    setProgress(ratio)
    // Applique la position en continu (throttle ~60 ms) pour que l'image suive
    // le doigt sans saturer le player.
    const now = Date.now()
    if (now - lastSeekApplyRef.current > 60) {
      lastSeekApplyRef.current = now
      try { player.currentTime = ratio * dur } catch {}
    }
    const totalSecs = Math.round(ratio * dur)
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    const usable = Math.max(1, barWidthRef.current - PAD * 2)
    setSeekInfo({ label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, x: PAD + ratio * usable })
  }, [player, setProgress])

  const seekEnd = useCallback(() => {
    isSeekingRef.current = false
    setIsSeeking(false)
    setSeekInfo(null)
    Animated.timing(activeAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start()
    if (player) {
      try {
        const dur = player.duration
        if (dur && dur > 0) player.currentTime = progressValueRef.current * dur
      } catch {}
    }
  }, [player, activeAnim])

  const seekBeginRef = useRef(seekBegin); seekBeginRef.current = seekBegin
  const seekUpdateRef = useRef(seekUpdate); seekUpdateRef.current = seekUpdate
  const seekEndRef = useRef(seekEnd); seekEndRef.current = seekEnd
  const xToRatioRef = useRef(xToRatio); xToRatioRef.current = xToRatio

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
        seekUpdateRef.current(xToRatioRef.current(locX))
      },
      onPanResponderMove: (_, g) => {
        seekUpdateRef.current(xToRatioRef.current(g.moveX))
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
      style={[
        styles.container,
        { bottom: bottomOffset + insets.bottom, opacity: barOpacity },
        translateY ? { transform: [{ translateY }] } : null,
      ]}
    >
      <Animated.View style={[styles.track, {
        height: activeAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 6] }),
        borderRadius: activeAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 6] }),
        backgroundColor: activeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.45)'],
        }),
      }]}>
        <Animated.View
          style={[styles.fill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </Animated.View>

      {(!isPlaying || isSeeking) && (
        <>
          <Animated.View
            style={[styles.thumb, {
              left: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [PAD, SCREEN_WIDTH - PAD] }),
              transform: [
                { translateX: -9 },
                { scale: activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
              ],
            }]}
          />
          {seekInfo && (
            <View style={[styles.timeLabel, { left: Math.max(20, Math.min(seekInfo.x - 26, SCREEN_WIDTH - 72)) }]}>
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
  track: { marginHorizontal: 16, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#00C853', borderRadius: 6 },
  thumb: {
    position: 'absolute', bottom: 60 / 2 - 9, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#00C853', borderWidth: 2, borderColor: '#FFF',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2,
  },
  timeLabel: {
    position: 'absolute', bottom: 34, backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  timeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
})
