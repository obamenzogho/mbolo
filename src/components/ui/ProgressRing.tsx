/* src/components/ui/ProgressRing.tsx

   Anneau de progression circulaire (minuteur façon Instagram) : un trait
   qui se remplit dans le sens horaire depuis le haut. Animé avec le core
   RN `Animated` (pattern ProgressBar) : le React Compiler d'Expo SDK 54
   rejette les shared values Reanimated écrites depuis des callbacks/effets
   dans ce projet (voir ADR déclencheur caméra). */

import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

interface ProgressRingProps {
  /** Taille carrée du conteneur (px). */
  size: number
  /** Épaisseur du trait (px). */
  strokeWidth: number
  /** Progression cible, bornée 0..1. */
  progress: number
  /** Couleur du trait de progression. */
  color: string
  /** Couleur de la piste (fond du tour). */
  trackColor: string
  /** Opacité de la piste (0..1), défaut : piste discrète. */
  trackOpacity?: number
  /** Durée d'animation vers la cible (ms). */
  animationMs: number
}

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
  trackOpacity = 0.18,
  animationMs,
}: ProgressRingProps) {
  const [anim] = useState(() => new Animated.Value(0))
  const center = size / 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: animationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start()
  }, [progress, animationMs, anim])

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  })

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={trackColor}
        strokeOpacity={trackOpacity}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <AnimatedCircle
        cx={center}
        cy={center}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${center} ${center})`}
        fill="none"
      />
    </Svg>
  )
}
