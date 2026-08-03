/* StraightenSlider.tsx — Slider personnalisé pour le straighten.

   Slider horizontal avec curseur rond, similaire au prototype web.
   Utilise un PanResponder natif (pas de dépendance externe). */

import { memo, useCallback } from 'react'
import { StyleSheet, View, type GestureResponderEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from 'react-native-reanimated'
import { createColors } from '../../theme/createTokens'

interface StraightenSliderProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

export const StraightenSlider = memo(function StraightenSlider({
  value,
  min,
  max,
  onChange,
}: StraightenSliderProps) {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const pct = useSharedValue(((value - min) / (max - min)) * 100)

  const updateFromX = useCallback(
    (x: number, width: number) => {
      const ratio = clamp(x / width, 0, 1)
      const v = Math.round(min + ratio * (max - min))
      pct.value = ratio * 100
      onChange(v)
    },
    [min, max, onChange, pct],
  )

  /* Pas de layout mesuré : on utilise un ref callback pour connaître la
     largeur du rail. On stocke la largeur dans un shared value pour
     l'utiliser dans le worklet. */
  const width = useSharedValue(0)

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const x = clamp(e.absoluteX, 0, width.value)
      const ratio = x / width.value
      const v = Math.round(min + ratio * (max - min))
      pct.value = ratio * 100
      runOnJS(onChange)(v)
    })

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(pct.value, { damping: 20, stiffness: 300 }) }],
  }))

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.rail}
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width
        }}
      >
        {/* Rail de fond */}
        <View style={styles.railBg} />
        {/* Rail actif (depuis le centre) */}
        <View
          style={[
            styles.railActive,
            {
              left: value >= 0 ? '50%' : `${pct.value}%`,
              right: value >= 0 ? `${100 - pct.value}%` : '50%',
            },
          ]}
        />
        {/* Curseur */}
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </View>
    </GestureDetector>
  )
})

const styles = StyleSheet.create({
  rail: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  railBg: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  railActive: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    backgroundColor: createColors.textPrimary,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#888',
    backgroundColor: '#fff',
    top: 7,
    marginLeft: -7,
  },
})
