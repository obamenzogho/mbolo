import { useEffect, useRef } from 'react'
import { View, Animated, Easing } from 'react-native'

const LETTERS = ['m', 'b', 'o', 'l', 'o']

export default function MboloLoader({ size = 48 }: { size?: number }) {
  const anims = useRef(LETTERS.map(() => new Animated.Value(0))).current
  const running = useRef(true)

  useEffect(() => {
    const bounce = (index: number) => {
      if (!running.current) return
      const anim = anims[index]
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => bounce(index))
    }

    LETTERS.forEach((_, i) => {
      setTimeout(() => bounce(i), i * 120)
    })

    return () => {
      running.current = false
    }
  }, [])

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      {LETTERS.map((letter, i) => {
        const translateY = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0, -12],
        })
        return (
          <Animated.Text
            key={i}
            style={{
              fontSize: size,
              fontWeight: 'bold',
              color: '#00A86B',
              letterSpacing: 2,
              transform: [{ translateY }],
            }}
          >
            {letter}
          </Animated.Text>
        )
      })}
    </View>
  )
}
