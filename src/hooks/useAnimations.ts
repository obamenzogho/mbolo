import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated'

export const useFadeAnimation = (initialValue = 0) => {
  const opacity = useSharedValue(initialValue)

  const fadeIn = (duration = 300) => {
    opacity.value = withTiming(1, { duration })
  }

  const fadeOut = (duration = 300) => {
    opacity.value = withTiming(0, { duration })
  }

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return { fadeIn, fadeOut, animatedStyle }
}

export const useScaleAnimation = () => {
  const scale = useSharedValue(1)

  const bounce = () => {
    scale.value = withSequence(
      withSpring(1.2, { damping: 2 }),
      withSpring(1, { damping: 4 })
    )
  }

  const pulse = (from = 1, to = 0.85, duration = 800) => {
    scale.value = withRepeat(
      withSequence(
        withTiming(to, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(from, { duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    )
  }

  const stopPulse = () => {
    scale.value = withTiming(1, { duration: 200 })
  }

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return { bounce, pulse, stopPulse, animatedStyle }
}

export const useSlideAnimation = (height: number) => {
  const translateY = useSharedValue(height)

  const slideUp = () => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 })
  }

  const slideDown = () => {
    translateY.value = withTiming(height, { duration: 250, easing: Easing.out(Easing.ease) })
  }

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))

  return { slideUp, slideDown, animatedStyle }
}

export const useRotationAnimation = () => {
  const rotation = useSharedValue(0)

  const startRotating = () => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1
    )
  }

  const stopRotating = () => {
    rotation.value = withTiming(0, { duration: 300 })
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }))

  return { startRotating, stopRotating, animatedStyle }
}

export const useProgressAnimation = () => {
  const progress = useSharedValue(0)

  const start = (duration = 2000) => {
    progress.value = withTiming(1, { duration, easing: Easing.inOut(Easing.ease) })
  }

  const reset = () => {
    progress.value = 0
  }

  const animatedStyle = (maxWidth: number) =>
    useAnimatedStyle(() => ({
      width: interpolate(progress.value, [0, 1], [0, maxWidth]),
    }))

  return { start, reset, animatedStyle }
}

export const useTabTransition = () => {
  const tabIndex = useSharedValue(0)
  const translateX = useSharedValue(0)

  const switchTab = (index: number, tabWidth: number) => {
    tabIndex.value = index
    translateX.value = withSpring(-index * tabWidth, { damping: 20, stiffness: 150 })
  }

  const animatedIndicator = (tabWidth: number) =>
    useAnimatedStyle(() => ({
      transform: [{ translateX: withSpring(tabIndex.value * tabWidth, { damping: 20, stiffness: 200 }) }],
      width: tabWidth,
    }))

  const animatedContent = (tabWidth: number) =>
    useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
      width: tabWidth * 3,
    }))

  return { switchTab, animatedIndicator, animatedContent }
}

export const useCountdownAnimation = () => {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  const animateCount = (onComplete?: () => void) => {
    scale.value = withSequence(
      withTiming(1.5, { duration: 200 }),
      withTiming(1, { duration: 600 })
    )
    opacity.value = withSequence(
      withTiming(0.3, { duration: 200 }),
      withTiming(1, { duration: 600 })
    )
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return { animateCount, animatedStyle }
}

export const useBlinkAnimation = () => {
  const opacity = useSharedValue(1)

  const startBlink = (interval = 500) => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: interval }),
        withTiming(1, { duration: interval })
      ),
      -1
    )
  }

  const stopBlink = () => {
    opacity.value = withTiming(1, { duration: 100 })
  }

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return { startBlink, stopBlink, animatedStyle }
}

export const useDeleteZoneAnimation = () => {
  const scale = useSharedValue(0.5)
  const opacity = useSharedValue(0)

  const show = () => {
    scale.value = withSpring(1, { damping: 12 })
    opacity.value = withTiming(1, { duration: 200 })
  }

  const hide = () => {
    scale.value = withTiming(0.5, { duration: 150 })
    opacity.value = withTiming(0, { duration: 200 })
  }

  const shake = () => {
    scale.value = withSequence(
      withTiming(1.1, { duration: 80 }),
      withTiming(0.9, { duration: 80 }),
      withTiming(1.05, { duration: 80 }),
      withTiming(1, { duration: 80 })
    )
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return { show, hide, shake, animatedStyle }
}

export const useRecordButtonAnimation = () => {
  const innerScale = useSharedValue(1)
  const borderScale = useSharedValue(1)
  const progress = useSharedValue(0)

  const startRecording = (duration: number) => {
    innerScale.value = withSpring(0.65, { damping: 10 })
    progress.value = withTiming(1, { duration })
  }

  const stopRecording = () => {
    innerScale.value = withSpring(1, { damping: 10 })
    progress.value = withTiming(0, { duration: 200 })
  }

  const innerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }))

  const progressAnimatedStyle = useAnimatedStyle((): any => ({
    strokeDashoffset: interpolate(progress.value, [0, 1], [CIRCUMFERENCE, 0]),
  }))

  return { startRecording, stopRecording, innerAnimatedStyle, progressAnimatedStyle }
}

const CIRCUMFERENCE = 2 * Math.PI * 42
