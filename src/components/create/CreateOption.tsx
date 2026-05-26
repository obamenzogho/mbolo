import React, { useCallback, useEffect } from 'react'
import { View, Text, Pressable } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withSequence } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { useHaptics } from '../../hooks/useHaptics'

interface CreateOptionProps {
  icon: string
  label: string
  index: number
  onPress: () => void
}

function CreateOptionComponent({ icon, label, index, onPress }: CreateOptionProps) {
  const scale = useSharedValue(1)
  const entryScale = useSharedValue(0.6)
  const entryOpacity = useSharedValue(0)
  const { lightImpact } = useHaptics()

  useEffect(() => {
    entryScale.value = withDelay(
      index * 60,
      withSpring(1, { stiffness: 200, damping: 14 }),
    )
    entryOpacity.value = withDelay(
      index * 60,
      withSpring(1, { stiffness: 200, damping: 14 }),
    )
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * entryScale.value }],
    opacity: entryOpacity.value,
  }))

  const handlePress = useCallback(() => {
    lightImpact()
    scale.value = withSequence(
      withSpring(0.9, { stiffness: 500, damping: 12 }),
      withSpring(1, { stiffness: 400, damping: 15 }),
    )
    onPress()
  }, [onPress, lightImpact, scale])

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[{
        width: 80, height: 90,
        alignItems: 'center', justifyContent: 'center',
        gap: 6,
      }, animatedStyle]}>
        <View style={{
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: colors.primary,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon as any} size={28} color={colors.white} />
        </View>
        <Text style={{ color: colors.white, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

export default React.memo(CreateOptionComponent)
