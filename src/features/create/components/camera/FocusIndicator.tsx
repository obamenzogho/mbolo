/* FocusIndicator.tsx — Anneau de mise au point au tap sur le preview caméra.

   Composant purement visuel : expo-camera v17 n'expose pas d'API pour
   définir un point de focus manuel. L'anneau donne un retour utilisateur
   immédiat (haptique + animation) et signale que le tap a été pris en
   compte. Sur iOS, le prop `autofocus='on'` force un cycle autofocus
   après chaque tap.

   Animation (UI thread Reanimated) :
   1. L'anneau apparaît à l'échelle 0.4 (fade in rapide, 150 ms)
   2. Il grandit jusqu'à 1.0 (spring doux)
   3. Il reste visible 600 ms
   4. Il s'estompe (fade out 200 ms)

   Le composant ne capture pas les touches (`pointerEvents="none"`) pour
   ne pas interférer avec le pinch-to-zoom. */

import { memo, useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated'
import { cameraColors } from '../../theme/createTokens'

export interface FocusPoint {
  x: number
  y: number
}

interface FocusIndicatorProps {
  /** Position du tap. `null` = aucun indicateur affiché. */
  point: FocusPoint | null
  /** Callback quand l'animation de disparition est terminée. */
  onAnimationComplete: () => void
}

/* Dimensions de l'anneau (diamètre extérieur). */
const RING_SIZE = 80
const RING_BORDER_WIDTH = 2

/* Durées d'animation en ms. */
const FADE_IN_MS = 150
const HOLD_MS = 600
const FADE_OUT_MS = 200
/* Durée totale (fade in + hold + fade out) — utilisée par le setTimeout
   JS qui retire l'anneau une fois l'animation Reanimated terminée. */
const TOTAL_ANIMATION_MS = FADE_IN_MS + HOLD_MS + FADE_OUT_MS

/* Configuration du spring pour le scale-up. */
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 300,
  mass: 0.8,
}

function FocusIndicatorComponent({
  point,
  onAnimationComplete,
}: FocusIndicatorProps) {
  const scale = useSharedValue(0.4)
  const opacity = useSharedValue(0)
  /* Timeout JS qui retire l'anneau une fois l'animation terminée :
     `runOnJS` dans `withSequence` n'est pas supporté par le typage
     Reanimated v4, et un timer est plus fiable. */
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (!point) {
      scale.value = 0.4
      opacity.value = 0
      return
    }

    /* Séquence : fade in → spring scale → hold → fade out. */
    scale.value = withSequence(
      withTiming(0.4, { duration: 0, easing: Easing.linear }),
      withSpring(1, SPRING_CONFIG),
    )

    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: HOLD_MS, easing: Easing.linear }),
      withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.cubic) }),
    )

    timeoutRef.current = setTimeout(onAnimationComplete, TOTAL_ANIMATION_MS)
  }, [point, onAnimationComplete, scale, opacity])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  if (!point) return null

  return (
    <View
      style={[
        styles.container,
        { left: point.x - RING_SIZE / 2, top: point.y - RING_SIZE / 2 },
      ]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.ring, animatedStyle]} />
    </View>
  )
}

export const FocusIndicator = memo(FocusIndicatorComponent)

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_BORDER_WIDTH,
    borderColor: cameraColors.focusRing,
  },
})