import { useCallback, useMemo } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useFocusEffect } from 'expo-router'
import { useGoBack } from '@/hooks/useGoBack'
import { useAppliedAccessibility } from '@/features/settings/appliedStore'

const EDGE_WIDTH = 44
const DISMISS_RATIO = 0.5
const VELOCITY_THRESHOLD = 800
const CLOSE_DURATION = 220

export interface UseSwipeBackOptions {
  enabled?: boolean
  edgeOnly?: boolean
  backTo?: string
  onBack?: () => void
}

export function useSwipeBack({
  enabled = true,
  edgeOnly = false,
  backTo = '/(tabs)/feed',
  onBack,
}: UseSwipeBackOptions = {}) {
  const reduceMotion = useAppliedAccessibility((s) => s.reduceMotion)
  const { goBack } = useGoBack()
  // useWindowDimensions : suit la rotation et le redimensionnement du navigateur.
  const { width } = useWindowDimensions()

  const translateX = useSharedValue(0)
  const closing = useSharedValue(false)

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack()
      return
    }
    goBack(backTo)
  }, [onBack, goBack, backTo])

  // Capturé hors worklet : `Platform` n'est pas accessible dans les worklets.
  const isIOS = Platform.OS === 'ios'

  useFocusEffect(
    useCallback(() => {
      translateX.value = 0
      closing.value = false
    }, [])
  )

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(enabled)
      // Valeur positive : n'active le geste que sur un drag vers la droite.
      .activeOffsetX(35)
      .failOffsetY([-40, 40])
      .onUpdate((e) => {
        if (closing.value) return
        translateX.value = Math.max(0, e.translationX)
      })
      .onEnd((e) => {
        if (closing.value) return
        const shouldClose =
          e.translationX > width * DISMISS_RATIO || e.velocityX > VELOCITY_THRESHOLD

        if (shouldClose) {
          closing.value = true
          if (isIOS) {
            // iOS : pas de fausse fermeture JS — la sous-couche simulée est un fond
            // noir. On réinitialise la translation et on laisse le pop natif jouer
            // sa parallaxe sur la vraie page précédente (pas d'écran noir).
            translateX.value = 0
            runOnJS(handleBack)()
          } else {
            translateX.value = withTiming(
              width,
              { duration: reduceMotion ? 0 : CLOSE_DURATION, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) runOnJS(handleBack)()
              }
            )
          }
        } else {
          translateX.value = withSpring(0, {
            damping: 32,
            stiffness: 240,
            overshootClamping: true,
          })
        }
      })

    return edgeOnly ? pan.hitSlop({ left: 0, width: EDGE_WIDTH }) : pan
  }, [enabled, edgeOnly, reduceMotion, handleBack, width])

  /** Page courante : uniquement transform, seule propriété animable partout (web inclus). */
  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  /** Ombre du bord gauche : un calque dédié, car shadowOpacity n'est pas animable sur web. */
  const edgeShadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 32], [0, 1], Extrapolation.CLAMP),
  }))

  /** Écran précédent simulé : voile sombre qui s'éclaircit pendant le drag. */
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, width], [1, 0], Extrapolation.CLAMP),
  }))

  /** Parallaxe de l'arrière-plan, comme iOS. */
  const underlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(translateX.value, [0, width], [-width * 0.25, 0], Extrapolation.CLAMP) },
    ],
  }))

  return { gesture, pageStyle, edgeShadowStyle, scrimStyle, underlayStyle, translateX }
}
