/* CropOverlay.tsx — Recadrage style Instagram.

   Le cadre de recadrage est FIXE au centre de l'écran.
   L'image se déplace et zoome derrière le cadre.

   La transformation est appliquée DIRECTEMENT à l'image (pas à
   une zone transparente) pour un retour visuel immédiat.

   Combine des gestes dédiés au pan et au pinch pour que chaque interaction
   conserve ses coordonnées et ses limites exactes. */

import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from 'react-native-reanimated'
import type { CropState } from '../../types/editing'
import { MAX_CROP_ZOOM } from '../../utils/cropGeometry'
import {
  rotatedCanvas,
  coverFit,
  panPreviewToSource,
  panSourceToPreview,
} from '../../utils/cropGeometry'

interface CropOverlayProps {
  uri: string
  frameWidth: number
  frameHeight: number
  crop: CropState
  sourceWidth: number
  sourceHeight: number
  cropTransform?: { scale: number; translateX: number; translateY: number }
  onTransformChange: (transform: { scale: number; translateX: number; translateY: number }) => void
}

const PAN_ACTIVATION_DISTANCE = 2
const PAN_BOUNDARY_RESISTANCE = 0.28
const CROP_SPRING = {
  damping: 24,
  stiffness: 280,
  mass: 0.7,
} as const

export const CropOverlay = memo(function CropOverlay({
  uri,
  frameWidth,
  frameHeight,
  crop,
  sourceWidth,
  sourceHeight,
  cropTransform,
  onTransformChange,
}: CropOverlayProps) {
  /* ── Dimensions calculées ─────────────────────────────────────── */
  const canvas = useMemo(
    () => rotatedCanvas(sourceWidth, sourceHeight, crop.rotation),
    [sourceWidth, sourceHeight, crop.rotation],
  )

  /* Taille cover-fit de l'image (post-rotation) dans le cadre, à zoom 1. */
  const rendered = useMemo(
    () => coverFit(canvas.w, canvas.h, frameWidth, frameHeight),
    [canvas.w, canvas.h, frameWidth, frameHeight],
  )

  const rotation = ((crop.rotation % 360) + 360) % 360
  const isQuarterTurn = rotation === 90 || rotation === 270

  /* `rendered` représente toujours le canvas APRÈS rotation. L'image source
     est donc tournée à l'intérieur de ce canvas, avec ses dimensions avant
     rotation. La version précédente échangeait ces dimensions une seconde
     fois : le média était étiré et le pan ne correspondait plus à l'export. */
  const sourceViewWidth = isQuarterTurn ? rendered.h : rendered.w
  const sourceViewHeight = isQuarterTurn ? rendered.w : rendered.h

  /* ── Shared values ────────────────────────────────────────────── */
  const initialTransform = useMemo(() => ({
    scale: cropTransform?.scale ?? 1,
    translateX: cropTransform?.translateX ? panSourceToPreview(
      cropTransform.translateX, canvas.w, rendered.w, cropTransform.scale ?? 1,
    ) : 0,
    translateY: cropTransform?.translateY ? panSourceToPreview(
      cropTransform.translateY, canvas.h, rendered.h, cropTransform.scale ?? 1,
    ) : 0,
  }), [canvas.h, canvas.w, cropTransform, rendered.h, rendered.w])

  const scale = useSharedValue(initialTransform.scale)
  const translateX = useSharedValue(initialTransform.translateX)
  const translateY = useSharedValue(initialTransform.translateY)

  /* Sync depuis les props (ex: reset). */
  const prevTransformKey = useRef('')
  useEffect(() => {
    const key = cropTransform
      ? `${cropTransform.scale}|${cropTransform.translateX}|${cropTransform.translateY}`
      : ''
    if (key !== prevTransformKey.current) {
      prevTransformKey.current = key
      scale.value = cropTransform?.scale ?? 1
      if (cropTransform) {
        translateX.value = panSourceToPreview(
          cropTransform.translateX, canvas.w, rendered.w, cropTransform.scale ?? 1,
        )
        translateY.value = panSourceToPreview(
          cropTransform.translateY, canvas.h, rendered.h, cropTransform.scale ?? 1,
        )
      } else {
        translateX.value = 0
        translateY.value = 0
      }
    }
  }, [canvas.h, canvas.w, cropTransform, rendered.h, rendered.w])

  /* ── Notification (source px) ─────────────────────────────────── */
  const notifyChange = useCallback(
    (s: number, tx: number, ty: number) => {
      const panX = panPreviewToSource(tx, canvas.w, rendered.w, s)
      const panY = panPreviewToSource(ty, canvas.h, rendered.h, s)
      onTransformChange({ scale: s, translateX: panX, translateY: panY })
    },
    [onTransformChange, canvas.w, canvas.h, rendered.w, rendered.h],
  )

  /* ── Gesture principal ──────────────────────────────────────────
     Tout le calcul est INLINE dans le worklet (pas d'appels à des
     fonctions JS). Les valeurs captured (rendered.w, frameWidth…)
     sont des nombres, worklet-compatible. */
  const initialScale = useSharedValue(1)
  const lastX = useSharedValue(0)
  const lastY = useSharedValue(0)
  const panGesture = Gesture.Pan()
    .maxPointers(1)
    .averageTouches(true)
    .activeOffsetX([-PAN_ACTIVATION_DISTANCE, PAN_ACTIVATION_DISTANCE])
    .activeOffsetY([-PAN_ACTIVATION_DISTANCE, PAN_ACTIVATION_DISTANCE])
    .onBegin((e) => {
      lastX.value = translateX.value
      lastY.value = translateY.value
    })
    .onUpdate((e) => {
      /* Bornes de pan — inline, pas de fonctions JS. */
      const rw = rendered.w, rh = rendered.h, fw = frameWidth, fh = frameHeight
      const maxX = Math.max(0, (scale.value * rw - fw) / 2)
      const maxY = Math.max(0, (scale.value * rh - fh) / 2)
      const panX = lastX.value + e.translationX
      const panY = lastY.value + e.translationY
      const boundedX = Math.min(Math.max(panX, -maxX), maxX)
      const boundedY = Math.min(Math.max(panY, -maxY), maxY)
      translateX.value = maxX > 0
        ? boundedX + (panX - boundedX) * PAN_BOUNDARY_RESISTANCE
        : 0
      translateY.value = maxY > 0
        ? boundedY + (panY - boundedY) * PAN_BOUNDARY_RESISTANCE
        : 0
    })
    .onEnd(() => {
      const maxX = Math.max(0, (scale.value * rendered.w - frameWidth) / 2)
      const maxY = Math.max(0, (scale.value * rendered.h - frameHeight) / 2)
      const settledX = Math.min(Math.max(translateX.value, -maxX), maxX)
      const settledY = Math.min(Math.max(translateY.value, -maxY), maxY)

      translateX.value = withSpring(settledX, CROP_SPRING)
      translateY.value = withSpring(settledY, CROP_SPRING, (finished) => {
        if (finished) {
          runOnJS(notifyChange)(scale.value, translateX.value, translateY.value)
        }
      })
    })

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      initialScale.value = scale.value
      lastX.value = translateX.value
      lastY.value = translateY.value
    })
    .onUpdate((e) => {
      const newScale = Math.min(Math.max(initialScale.value * e.scale, 1), MAX_CROP_ZOOM)
      const scaleRatio = newScale / initialScale.value
      const focalX = e.focalX - frameWidth / 2
      const focalY = e.focalY - frameHeight / 2
      const rw = rendered.w, rh = rendered.h, fw = frameWidth, fh = frameHeight
      const maxX = Math.max(0, (newScale * rw - fw) / 2)
      const maxY = Math.max(0, (newScale * rh - fh) / 2)
      const nextX = focalX - (focalX - lastX.value) * scaleRatio
      const nextY = focalY - (focalY - lastY.value) * scaleRatio
      const boundedX = Math.min(Math.max(nextX, -maxX), maxX)
      const boundedY = Math.min(Math.max(nextY, -maxY), maxY)

      scale.value = newScale
      translateX.value = maxX > 0
        ? boundedX + (nextX - boundedX) * PAN_BOUNDARY_RESISTANCE
        : 0
      translateY.value = maxY > 0
        ? boundedY + (nextY - boundedY) * PAN_BOUNDARY_RESISTANCE
        : 0
    })
    .onEnd(() => {
      const maxX = Math.max(0, (scale.value * rendered.w - frameWidth) / 2)
      const maxY = Math.max(0, (scale.value * rendered.h - frameHeight) / 2)
      const settledX = Math.min(Math.max(translateX.value, -maxX), maxX)
      const settledY = Math.min(Math.max(translateY.value, -maxY), maxY)

      translateX.value = withSpring(settledX, CROP_SPRING)
      translateY.value = withSpring(settledY, CROP_SPRING, (finished) => {
        if (finished) {
          runOnJS(notifyChange)(scale.value, translateX.value, translateY.value)
        }
      })
    })

  /* Aucun geste n'attend la reconnaissance d'un autre : le mouvement démarre
     au premier frame, y compris sur les appareils Android moins puissants. */
  const gesture = Gesture.Simultaneous(panGesture, pinchGesture)

  /* ── Animation ────────────────────────────────────────────────── */
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  /* Straighten : zoom pour éviter les coins noirs lors de la rotation. */
  const straighten = crop.straighten ?? 0
  const straightenAngle = (straighten * Math.PI) / 180
  const zoomFactor = straighten !== 0
    ? Math.max(
        (canvas.w * Math.abs(Math.cos(straightenAngle)) + canvas.h * Math.abs(Math.sin(straightenAngle))) / canvas.w,
        (canvas.w * Math.abs(Math.sin(straightenAngle)) + canvas.h * Math.abs(Math.cos(straightenAngle))) / canvas.h,
      )
    : 1

  return (
    <View style={styles.container}>
      {/* Fenêtre de recadrage FIXE (clip) — reçoit les touches */}
      <View
        style={[
          styles.frameClip,
          { width: frameWidth, height: frameHeight },
        ]}
      >
        {/* Cadre de recadrage + grille — pas de touches */}
        <View style={[styles.frame, { width: frameWidth, height: frameHeight }]} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
          <View style={styles.gridLineHorizontal1} />
          <View style={styles.gridLineHorizontal2} />
          <View style={styles.gridLineVertical1} />
          <View style={styles.gridLineVertical2} />
        </View>

        {/* Image animée (gestures + pan/zoom + rotation/flip) */}
        <GestureDetector gesture={gesture}>
          <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
            <View
              style={{
                width: rendered.w,
                height: rendered.h,
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginLeft: -rendered.w / 2,
                marginTop: -rendered.h / 2,
                overflow: 'visible',
              }}
            >
              <Image
                source={{ uri }}
                style={{
                  width: sourceViewWidth,
                  height: sourceViewHeight,
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginLeft: -sourceViewWidth / 2,
                  marginTop: -sourceViewHeight / 2,
                  transform: [
                    ...(crop.flipH ? [{ scaleX: -1 }] : []),
                    ...(crop.flipV ? [{ scaleY: -1 }] : []),
                    { rotate: `${rotation + straighten}deg` },
                    ...(straighten !== 0 ? [{ scale: zoomFactor }] : []),
                  ],
                }}
                contentFit="cover"
                transition={0}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameClip: {
    overflow: 'hidden',
    borderRadius: 2,
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    zIndex: 1,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#fff',
  },
  cornerTopLeft: { top: -1, left: -1, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTopRight: { top: -1, right: -1, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBottomLeft: { bottom: -1, left: -1, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBottomRight: { bottom: -1, right: -1, borderBottomWidth: 3, borderRightWidth: 3 },
  gridLineHorizontal1: { position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  gridLineHorizontal2: { position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  gridLineVertical1: { position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  gridLineVertical2: { position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
})
