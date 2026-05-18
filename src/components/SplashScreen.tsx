import { useEffect, useRef, useCallback } from 'react'
import { View, Text, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated'

const SCREEN_WIDTH = Dimensions.get('window').width

export default function SplashScreen({ onReady }: { onReady?: () => void }) {
  const calledRef = useRef(false)
  const scale = useSharedValue(1)
  const progress = useSharedValue(0)
  const opacity = useSharedValue(0)

  const triggerReady = useCallback(() => {
    if (!calledRef.current) {
      calledRef.current = true
      onReady?.()
    }
  }, [onReady])

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 })

    scale.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    )

    progress.value = withTiming(1, {
      duration: 2000,
      easing: Easing.inOut(Easing.ease),
    })

    const timer = setTimeout(() => {
      triggerReady()
    }, 2000)

    return () => {
      clearTimeout(timer)
    }
  }, [])

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }))

  return (
    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
      <Animated.Text
        style={{
          fontSize: 52,
          fontWeight: 'bold',
          color: '#00A86B',
          letterSpacing: 4,
          ...logoAnimatedStyle,
        }}
      >
        mbolo
      </Animated.Text>
      <Animated.Text
        style={{
          color: '#888',
          fontSize: 14,
          marginTop: 8,
          letterSpacing: 1,
          ...subtitleAnimatedStyle,
        }}
      >
        Le réseau social gabonais
      </Animated.Text>

      <View
        style={{
          position: 'absolute',
          bottom: 80,
          left: 40,
          right: 40,
          height: 3,
          backgroundColor: '#222',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            backgroundColor: '#FCD116',
            borderRadius: 2,
            ...progressStyle,
          }}
        />
      </View>
    </View>
  )
}