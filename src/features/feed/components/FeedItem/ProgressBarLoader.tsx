/* ProgressBarLoader — boules OrbitLoader (vert / jaune / bleu) qui glissent de
   la gauche vers la droite le long de la barre de progression quand la vidéo
   bufferise sur connexion lente. Purement décoratif (pointerEvents none). */

import { useEffect, useRef } from 'react'
import { View, Animated, Easing, StyleSheet } from 'react-native'

const COLORS = ['#00A86B', '#FFD700', '#3A75C4']
const DOT = 7
const GAP = 5 // décalage temporel entre chaque boule
const DURATION = 1100

interface ProgressBarLoaderProps {
  width: number
  left: number
}

export function ProgressBarLoader({ width, left }: ProgressBarLoaderProps) {
  const progress = useRef(new Animated.Value(0)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    const loop = () => {
      progress.setValue(0)
      animRef.current = Animated.timing(progress, {
        toValue: 1,
        duration: DURATION,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
      animRef.current.start(({ finished }) => { if (finished) loop() })
    }
    loop()
    return () => { animRef.current?.stop() }
  }, [progress])

  const travel = Math.max(1, width - DOT)

  return (
    <View pointerEvents="none" style={[styles.wrap, { left, width, bottom: 0 }]}>
      {COLORS.map((color, i) => {
        // Chaque boule est décalée dans le temps pour créer une traînée.
        const shifted = Animated.modulo(
          Animated.add(progress, new Animated.Value(-i * (GAP / 100))),
          1,
        )
        const translateX = shifted.interpolate({
          inputRange: [0, 1],
          outputRange: [0, travel],
        })
        const opacity = shifted.interpolate({
          inputRange: [0, 0.1, 0.9, 1],
          outputRange: [0, 1, 1, 0],
        })
        return (
          <Animated.View
            key={color}
            style={[
              styles.dot,
              { backgroundColor: color, transform: [{ translateX }], opacity },
            ]}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', height: DOT, justifyContent: 'center' },
  dot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
})
