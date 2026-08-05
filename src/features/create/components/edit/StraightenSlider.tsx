/* StraightenSlider.tsx — Slider personnalisé pour le straighten.

   Slider horizontal avec curseur rond. Utilise PanResponder natif
   (pas de worklet) pour une compatibilité totale avec Expo Go. */

import { memo, useRef } from 'react'
import { PanResponder, StyleSheet, View } from 'react-native'
import { createColors } from '../../theme/createTokens'

interface StraightenSliderProps {
  value: number
  min: number
  max: number
  /** Granularité de la valeur. Les réglages angulaires restent à 1°. */
  step?: number
  /** Le rail démarre au minimum pour les réglages strictement positifs. */
  centered?: boolean
  onChange: (value: number) => void
}

export const StraightenSlider = memo(function StraightenSlider({
  value,
  min,
  max,
  step = 1,
  centered = min < 0 && max > 0,
  onChange,
}: StraightenSliderProps) {
  const widthRef = useRef(0)
  const startValueRef = useRef(0)

  /* Ref toujours à jour sur la valeur courante. */
  const valueRef = useRef(value)
  valueRef.current = value

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  /* Le PanResponder utilise UNIQUEMENT des refs, jamais les props directement,
     pour éviter les closures périmées. */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
      onPanResponderGrant: () => {
        startValueRef.current = valueRef.current  // ← toujours à jour
      },
      onPanResponderMove: (_, gs) => {
        const w = widthRef.current
        if (w <= 0) return
        const valueRange = max - min
        const delta = (gs.dx / w) * valueRange
        const rawValue = startValueRef.current + delta
        const snappedValue = Math.round(rawValue / step) * step
        const v = clamp(snappedValue, min, max)
        onChangeRef.current(v)
      },
    }),
  ).current

  const pct = ((value - min) / (max - min)) * 100

  return (
    <View
      style={styles.rail}
      {...panResponder.panHandlers}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width
      }}
    >
      {/* Rail de fond */}
      <View style={styles.railBg} />
      {/* Rail actif (depuis le centre) */}
      <View
        style={[
          styles.railActive,
          {
            left: centered ? (value >= 0 ? '50%' : `${pct}%`) : '0%',
            right: centered ? (value >= 0 ? `${100 - pct}%` : '50%') : `${100 - pct}%`,
          },
        ]}
      />
      {/* Curseur */}
      <View
        style={[
          styles.thumb,
          { left: `${pct}%` },
        ]}
      />
    </View>
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
