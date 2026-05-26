import React, { useEffect } from 'react'
import { Pressable, Text } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'

interface TabItemProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  isActive: boolean
  onPress: () => void
}

const ICON_SIZE = 26
const LABEL_SIZE = 11

const TabItem = React.memo(function TabItem({
  icon,
  label,
  isActive,
  onPress,
}: TabItemProps) {
  const pressScale = useSharedValue(1)
  const activeScale = useSharedValue(isActive ? 1.05 : 1)

  useEffect(() => {
    activeScale.value = withSpring(isActive ? 1.05 : 1, {
      stiffness: 200,
      damping: 12,
    })
  }, [isActive])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * activeScale.value }],
  }))

  const handlePress = () => {
    pressScale.value = withSequence(
      withSpring(0.92, { stiffness: 500, damping: 12 }),
      withSpring(1, { stiffness: 400, damping: 15 }),
    )
    onPress()
  }

  const iconColor = isActive ? colors.primary : colors.textSecondary
  const labelColor = isActive ? colors.primary : colors.textSecondary

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 4,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Animated.View
        style={[{ alignItems: 'center', justifyContent: 'center' }, animatedStyle]}
      >
        <Ionicons name={icon} size={ICON_SIZE} color={iconColor} />
        <Text
          numberOfLines={1}
          style={{
            fontSize: LABEL_SIZE,
            fontWeight: isActive ? '700' : '500',
            color: labelColor,
            marginTop: 4,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}, (prev, next) => {
  return (
    prev.isActive === next.isActive &&
    prev.icon === next.icon &&
    prev.label === next.label
  )
})

export default TabItem
