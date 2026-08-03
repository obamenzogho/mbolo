/* TrimTab.tsx — Onglet Découper, réservé aux vidéos.

   Trim par poignées sur une bande de vignettes, coupure du son, et
   choix de la couverture. Écrit dans media.video ; renderVideo lit
   ces valeurs et applique -ss / -t / -an au moment de la publication. */

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import type { VideoEdit } from '../../types/editing'
import { DEFAULT_VIDEO_EDIT } from '../../types/editing'
import { createColors } from '../../theme/createTokens'
import { useFilmstrip, FILMSTRIP_FRAMES } from '../../hooks/useFilmstrip'

/** Un clip plus court n'est pas regardable. */
const MIN_DURATION_MS = 1000
/** Plafond des reels. Au-delà, on tronque la fin à l'ouverture. */
const MAX_DURATION_MS = 90_000
const HANDLE_W = 14

interface TrimTabProps {
  uri: string
  durationMs: number
  value: VideoEdit
  onChange: (next: VideoEdit) => void
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 100) / 10)
  const m = Math.floor(total / 60)
  const s = (total % 60).toFixed(1)
  return m > 0 ? `${m}:${s.padStart(4, '0')}` : `${s}s`
}

export const TrimTab = memo(function TrimTab({
  uri,
  durationMs,
  value,
  onChange,
}: TrimTabProps) {
  const frames = useFilmstrip(uri, durationMs)
  const [railW, setRailW] = useState(0)

  const start = value.trimStart || 0
  const end = value.trimEnd || durationMs

  /* Positions en pixels, pilotées par les worklets. */
  const leftX = useSharedValue(0)
  const rightX = useSharedValue(0)
  const leftFrom = useSharedValue(0)
  const rightFrom = useSharedValue(0)

  const msPerPx = railW > 0 && durationMs > 0 ? durationMs / railW : 0

  /* Vidéo trop longue : on cadre sur les 90 premières secondes plutôt
     que de laisser l'upload se faire refuser plus tard. */
  useEffect(() => {
    if (durationMs > 0 && !value.trimEnd) {
      onChange({
        ...DEFAULT_VIDEO_EDIT,
        ...value,
        trimEnd: Math.min(durationMs, MAX_DURATION_MS),
      })
    }
  }, [durationMs, value, onChange])

  /* Synchronise les poignées quand le rail est mesuré. */
  useEffect(() => {
    if (railW <= 0 || durationMs <= 0) return
    leftX.value = (start / durationMs) * railW
    rightX.value = (end / durationMs) * railW
  }, [railW, durationMs, start, end, leftX, rightX])

  const commit = useCallback(
    (nextStart: number, nextEnd: number) => {
      onChange({
        ...DEFAULT_VIDEO_EDIT,
        ...value,
        trimStart: Math.round(nextStart),
        trimEnd: Math.round(nextEnd),
        /* La couverture doit rester dans le clip conservé. */
        coverTime: Math.min(Math.max(value.coverTime, nextStart), nextEnd),
      })
    },
    [value, onChange],
  )

  const clampW = useCallback((v: number, lo: number, hi: number) => {
    'worklet'
    return Math.max(lo, Math.min(hi, v))
  }, [])

  const minPx = msPerPx > 0 ? MIN_DURATION_MS / msPerPx : 0
  const maxPx = msPerPx > 0 ? MAX_DURATION_MS / msPerPx : railW

  const leftPan = Gesture.Pan()
    .onStart(() => { leftFrom.value = leftX.value })
    .onUpdate((e) => {
      const lo = Math.max(0, rightX.value - maxPx)
      leftX.value = clampW(leftFrom.value + e.translationX, lo, rightX.value - minPx)
    })
    .onEnd(() => {
      runOnJS(commit)(leftX.value * msPerPx, rightX.value * msPerPx)
    })

  const rightPan = Gesture.Pan()
    .onStart(() => { rightFrom.value = rightX.value })
    .onUpdate((e) => {
      const hi = Math.min(railW, leftX.value + maxPx)
      rightX.value = clampW(rightFrom.value + e.translationX, leftX.value + minPx, hi)
    })
    .onEnd(() => {
      runOnJS(commit)(leftX.value * msPerPx, rightX.value * msPerPx)
    })

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftX.value }] }))
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightX.value - HANDLE_W }] }))
  const windowStyle = useAnimatedStyle(() => ({
    left: leftX.value,
    width: Math.max(0, rightX.value - leftX.value),
  }))
  const dimLeftStyle = useAnimatedStyle(() => ({ width: leftX.value }))
  const dimRightStyle = useAnimatedStyle(() => ({ left: rightX.value }))

  const setCover = useCallback(
    (time: number) => onChange({ ...DEFAULT_VIDEO_EDIT, ...value, coverTime: Math.round(time) }),
    [value, onChange],
  )

  const toggleMute = useCallback(
    () => onChange({ ...DEFAULT_VIDEO_EDIT, ...value, muted: !value.muted }),
    [value, onChange],
  )

  const coverIndex = useMemo(() => {
    if (durationMs <= 0) return 0
    return Math.min(
      FILMSTRIP_FRAMES - 1,
      Math.floor((value.coverTime / durationMs) * FILMSTRIP_FRAMES),
    )
  }, [value.coverTime, durationMs])

  /* Garde-fou : sans durée, la bande et les poignées ne peuvent pas
     fonctionner (durationMs = 0 arrive quand le picker ne renseigne
     pas asset.duration). */
  if (durationMs <= 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Durée indisponible</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Durée conservée */}
      <View style={styles.headerRow}>
        <Text style={styles.label}>Durée</Text>
        <Text style={styles.duration}>{formatTime(end - start)}</Text>
      </View>

      {/* Bande + poignées */}
      <View
        style={styles.rail}
        onLayout={(e) => setRailW(e.nativeEvent.layout.width)}
      >
        <View style={styles.strip}>
          {frames.map((frame, i) => (
            <View key={i} style={styles.cell}>
              {frame ? (
                <Image source={{ uri: frame }} style={styles.cellImage} contentFit="cover" />
              ) : null}
            </View>
          ))}
        </View>

        {/* Zones exclues, assombries */}
        <Animated.View style={[styles.dim, dimLeftStyle]} pointerEvents="none" />
        <Animated.View style={[styles.dim, styles.dimRight, dimRightStyle]} pointerEvents="none" />

        {/* Cadre de la sélection */}
        <Animated.View style={[styles.window, windowStyle]} pointerEvents="none" />

        <GestureDetector gesture={leftPan}>
          <Animated.View style={[styles.handle, leftStyle]} hitSlop={12}>
            <View style={styles.grip} />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={rightPan}>
          <Animated.View style={[styles.handle, rightStyle]} hitSlop={12}>
            <View style={styles.grip} />
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Son */}
      <Pressable onPress={toggleMute} style={styles.row}>
        <Ionicons
          name={value.muted ? 'volume-mute' : 'volume-high'}
          size={18}
          color={value.muted ? createColors.textTertiary : createColors.textPrimary}
        />
        <Text style={[styles.rowLabel, value.muted && styles.rowLabelOff]}>
          {value.muted ? 'Son coupé' : 'Son activé'}
        </Text>
      </Pressable>

      {/* Couverture */}
      <View style={styles.coverBlock}>
        <Text style={styles.label}>Couverture</Text>
        <View style={styles.coverRow}>
          {frames.map((frame, i) => {
            const time = (durationMs / FILMSTRIP_FRAMES) * i
            const outside = time < start || time > end
            return (
              <Pressable
                key={i}
                disabled={outside}
                onPress={() => setCover(time)}
                style={[
                  styles.coverCell,
                  i === coverIndex && styles.coverCellActive,
                  outside && styles.coverCellOutside,
                ]}
              >
                {frame ? (
                  <Image source={{ uri: frame }} style={styles.cellImage} contentFit="cover" />
                ) : null}
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: { gap: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    fontSize: 11,
    color: createColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  duration: {
    fontSize: 13,
    fontWeight: '600',
    color: createColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  rail: { height: 52, justifyContent: 'center' },
  strip: { flexDirection: 'row', height: 52, borderRadius: 4, overflow: 'hidden' },
  cell: { flex: 1, backgroundColor: createColors.surfaceDim },
  cellImage: { width: '100%', height: '100%' },
  dim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dimRight: { left: undefined, right: 0 },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: createColors.accent,
    borderRadius: 4,
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_W,
    backgroundColor: createColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  grip: { width: 2, height: 18, borderRadius: 1, backgroundColor: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  rowLabel: { fontSize: 13, color: createColors.textPrimary },
  rowLabelOff: { color: createColors.textTertiary },
  coverBlock: { gap: 8 },
  coverRow: { flexDirection: 'row', gap: 4 },
  coverCell: {
    flex: 1,
    height: 40,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: createColors.surfaceDim,
  },
  coverCellActive: { borderColor: createColors.textPrimary },
  coverCellOutside: { opacity: 0.3 },
})
