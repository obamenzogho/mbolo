import React, { useCallback } from 'react'
import { Pressable } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { useHaptics } from '../../hooks/useHaptics'

interface CreateButtonProps {
  onPress: () => void
  size?: number
}

function CreateButtonComponent({ onPress, size = 40 }: CreateButtonProps) {
  const scale = useSharedValue(1)
  const glow = useSharedValue(0.4)
  const { lightImpact } = useHaptics()

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glow.value,
  }))

  const handlePress = useCallback(() => {
    lightImpact()
    scale.value = withSequence(
      withSpring(0.88, { stiffness: 400, damping: 10 }),
      withSpring(1, { stiffness: 300, damping: 15 }),
    )
    glow.value = withSequence(
      withSpring(0.8, { stiffness: 400, damping: 10 }),
      withSpring(0.4, { stiffness: 300, damping: 15 }),
    )
    onPress()
  }, [onPress, lightImpact, scale, glow])

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[{
          width: size, height: size, borderRadius: size / 2,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: colors.primary,
          backgroundColor: 'transparent',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 6,
        }, animatedStyle]}
      >
        <Ionicons name="add" size={size * 0.65} color={colors.white} />
      </Animated.View>
    </Pressable>
  )
}

export default React.memo(CreateButtonComponent)
