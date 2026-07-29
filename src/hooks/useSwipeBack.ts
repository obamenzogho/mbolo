import { useCallback, useContext, useMemo } from 'react'
import { Dimensions } from 'react-native'
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
import { NavigationHistoryContext } from '@/providers/NavigationHistoryProvider'
import { useAppliedAccessibility } from '@/features/settings/appliedStore'

const SCREEN_WIDTH = Dimensions.get('window').width
const EDGE_WIDTH = 44
const DISMISS_RATIO = 0.32
const VELOCITY_THRESHOLD = 650
const CLOSE_DURATION = 220

export interface UseSwipeBackOptions {
  /** Désactive le geste (ex: page plein écran caméra en cours d'enregistrement). */
  enabled?: boolean
  /** Le geste ne démarre que depuis le bord gauche. Obligatoire si la page a un scroll horizontal. */
  edgeOnly?: boolean
  /** Route de repli si la stack est vide. */
  backTo?: string
  /** Override du retour (ex: fermer un mode édition avant de quitter). */
  onBack?: () => void
}

export function useSwipeBack({
  enabled = true,
  edgeOnly = false,
  backTo = '/(tabs)/feed',
  onBack,
}: UseSwipeBackOptions = {}) {
  const reduceMotion = useAppliedAccessibility((s) => s.reduceMotion)
  const { goBack } = useContext(NavigationHistoryContext)

  const translateX = useSharedValue(0)
  const closing = useSharedValue(false)

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack()
      return
    }
    goBack(backTo)
  }, [onBack, goBack, backTo])

  // Si l'utilisateur revient sur la page (retour arrière), on remet la position à zéro.
  useFocusEffect(
    useCallback(() => {
      translateX.value = 0
      closing.value = false
    }, [])
  )

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(enabled)
      .activeOffsetX(12)
      .failOffsetY([-16, 16])
      .onUpdate((e) => {
        if (closing.value) return
        translateX.value = Math.max(0, e.translationX)
      })
      .onEnd((e) => {
        if (closing.value) return
        const shouldClose =
          e.translationX > SCREEN_WIDTH * DISMISS_RATIO || e.velocityX > VELOCITY_THRESHOLD

        if (shouldClose) {
          closing.value = true
          translateX.value = withTiming(
            SCREEN_WIDTH,
            { duration: reduceMotion ? 0 : CLOSE_DURATION, easing: Easing.out(Easing.cubic) },
            (finished) => {
              if (finished) runOnJS(handleBack)()
            }
          )
        } else {
          translateX.value = withSpring(0, {
            damping: 32,
            stiffness: 240,
            overshootClamping: true,
          })
        }
      })

    return edgeOnly ? pan.hitSlop({ left: 0, width: EDGE_WIDTH }) : pan
  }, [enabled, edgeOnly, reduceMotion, handleBack])

  /** Page courante : glisse vers la droite + ombre portée sur son bord gauche. */
  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    shadowOpacity: interpolate(translateX.value, [0, 24], [0, 0.28], Extrapolation.CLAMP),
  }))

  /** Écran précédent (simulé) : un voile sombre qui s'éclaircit pendant le drag. */
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SCREEN_WIDTH], [1, 0], Extrapolation.CLAMP),
  }))

  /** Léger parallaxe de l'arrière-plan, comme iOS. */
  const underlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(translateX.value, [0, SCREEN_WIDTH], [-SCREEN_WIDTH * 0.25, 0], Extrapolation.CLAMP) },
    ],
  }))

  return { gesture, pageStyle, scrimStyle, underlayStyle, translateX }
}
