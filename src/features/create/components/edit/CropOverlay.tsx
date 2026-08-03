/* CropOverlay.tsx — Recadrage style Instagram.

   Le cadre de recadrage est FIXE au centre de l'écran.
   L'image se déplace et zoome derrière le cadre.

   Utilise un seul gesture handler qui détecte le nombre
   de doigts pour différencier pan et pinch. */

import { memo, useCallback, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  clamp,
} from 'react-native-reanimated'
import type { CropState } from '../../types/editing'

interface CropOverlayProps {
  frameWidth: number
  frameHeight: number
  crop: CropState
  onTransformChange: (transform: { scale: number; translateX: number; translateY: number }) => void
}

export const CropOverlay = memo(function CropOverlay({
  frameWidth,
  frameHeight,
  crop,
  onTransformChange,
}: CropOverlayProps) {
  const scale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  const MIN_SCALE = 1
  const MAX_SCALE = 3

  const notifyChange = useCallback(
    (s: number, tx: number, ty: number) => {
      onTransformChange({ scale: s, translateX: tx, translateY: ty })
    },
    [onTransformChange],
  )

  /* Tracking pour le pinch. */
  const initialDistance = useSharedValue(0)
  const initialScale = useSharedValue(1)
  const lastScale = useSharedValue(1)

  /* Tracking pour le pan. */
  const lastX = useSharedValue(0)
  const lastY = useSharedValue(0)

  /* Double tap tracking. */
  const lastTapTime = useRef(0)

  /* ── Gesture principal ───────────────────────────────────────── */
  const gesture = Gesture.Pan()
    .minPointers(1)
    .onBegin((e) => {
      /* Si c'est un double tap (2 doigts qui touchent rapidement). */
      const now = Date.now()
      if (e.numberOfPointers === 2 && now - lastTapTime.current < 300) {
        /* Double tap avec 2 doigts : zoom 1.5x ou retour à 1x. */
        const newScale = scale.value > 1.2 ? 1 : 1.5
        scale.value = withSpring(newScale, { damping: 20 })
        if (newScale === 1) {
          translateX.value = withSpring(0, { damping: 20 })
          translateY.value = withSpring(0, { damping: 20 })
        }
        runOnJS(notifyChange)(newScale, translateX.value, translateY.value)
        lastTapTime.current = 0
        return
      }
      lastTapTime.current = now

      if (e.numberOfPointers === 2) {
        /* Début du pinch : calculer la distance initiale. */
        const dx = e.absoluteX - e.x
        const dy = e.absoluteY - e.y
        initialDistance.value = Math.sqrt(dx * dx + dy * dy)
        initialScale.value = scale.value
      } else {
        /* Début du pan. */
        lastX.value = translateX.value
        lastY.value = translateY.value
      }
    })
    .onUpdate((e) => {
      if (e.numberOfPointers === 2) {
        /* Pinch : calculer le nouveau scale. */
        const dx = e.absoluteX - e.x
        const dy = e.absoluteY - e.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const ratio = distance / initialDistance.value
        scale.value = clamp(initialScale.value * ratio, MIN_SCALE, MAX_SCALE)

        /* Ajuster la position pour rester dans les limites. */
        const maxTranslateX = (frameWidth * (scale.value - 1)) / 2
        const maxTranslateY = (frameHeight * (scale.value - 1)) / 2
        translateX.value = clamp(translateX.value, -maxTranslateX, maxTranslateX)
        translateY.value = clamp(translateY.value, -maxTranslateY, maxTranslateY)
      } else {
        /* Pan : déplacer l'image. */
        const maxTranslateX = (frameWidth * (scale.value - 1)) / 2
        const maxTranslateY = (frameHeight * (scale.value - 1)) / 2

        translateX.value = clamp(
          lastX.value + e.translationX,
          -maxTranslateX,
          maxTranslateX,
        )
        translateY.value = clamp(
          lastY.value + e.translationY,
          -maxTranslateY,
          maxTranslateY,
        )
      }
    })
    .onEnd(() => {
      runOnJS(notifyChange)(scale.value, translateX.value, translateY.value)
    })

  /* ── Double tap simple (1 doigt) ─────────────────────────────── */
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      const newScale = scale.value > 1.2 ? 1 : 1.5
      scale.value = withSpring(newScale, { damping: 20 })
      if (newScale === 1) {
        translateX.value = withSpring(0, { damping: 20 })
        translateY.value = withSpring(0, { damping: 20 })
      }
      runOnJS(notifyChange)(newScale, translateX.value, translateY.value)
    })

  /* Combiner : double tap prioritaire, sinon pan/pinch */
  const composed = Gesture.Exclusive(doubleTap, gesture)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  return (
    <View style={styles.container}>
      {/* Cadre de recadrage FIXE */}
      <View style={styles.frameContainer} pointerEvents="none">
        <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
          <View style={styles.gridLineHorizontal1} />
          <View style={styles.gridLineHorizontal2} />
          <View style={styles.gridLineVertical1} />
          <View style={styles.gridLineVertical2} />
        </View>
      </View>

      {/* Zone de gesture */}
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.gestureZone, animatedStyle]} />
      </GestureDetector>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  frameContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  gestureZone: {
    ...StyleSheet.absoluteFillObject,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#fff',
  },
  cornerTopLeft: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTopRight: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBottomLeft: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBottomRight: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
  gridLineHorizontal1: { position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  gridLineHorizontal2: { position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  gridLineVertical1: { position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  gridLineVertical2: { position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
})
