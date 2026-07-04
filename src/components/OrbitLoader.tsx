import { View, Animated, Easing } from 'react-native'
import { useEffect, useRef } from 'react'

const COLORS = ['#00A86B', '#FFD700', '#3A75C4']

export default function OrbitLoader({ size = 100 }: { size?: number }) {
  const rotation = useRef(new Animated.Value(0)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)
  const dotSize = Math.max(4, size * 0.12)

  useEffect(() => {
    const animate = () => {
      rotation.setValue(0)
      animRef.current = Animated.timing(rotation, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
      animRef.current.start(({ finished }) => {
        if (finished) animate()
      })
    }
    animate()
    return () => {
      animRef.current?.stop()
    }
  }, [])

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{ width: size, height: size, transform: [{ rotate }] }}>
        {COLORS.map((color, i) => {
          const angle = (i / COLORS.length) * Math.PI * 2
          const radius = size * 0.35
          const x = Math.cos(angle) * radius
          const y = Math.sin(angle) * radius
          return (
            <View
              key={color}
              style={{
                position: 'absolute',
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: color,
                left: size / 2 + x - dotSize / 2,
                top: size / 2 + y - dotSize / 2,
              }}
            />
          )
        })}
      </Animated.View>
    </View>
  )
}
