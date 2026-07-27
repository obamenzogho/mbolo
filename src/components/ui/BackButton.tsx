import React, { useCallback } from 'react'
import { TouchableOpacity, type ViewStyle, type GestureResponderEvent } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

interface BackButtonProps {
  icon?: keyof typeof Ionicons.glyphMap
  size?: number
  color?: string
  style?: ViewStyle
  onPress?: (event?: GestureResponderEvent) => void
  fallbackRoute?: string
}

function BackButtonComponent({ icon = 'arrow-back', size = 28, color = '#fff', style, onPress, fallbackRoute = '/(tabs)/feed' }: BackButtonProps) {
  const handlePress = useCallback((_e?: GestureResponderEvent) => {
    if (onPress) { onPress(_e); return }
    if (router.canGoBack()) router.back()
    else router.replace(fallbackRoute as any)
  }, [onPress, fallbackRoute])

  return (
    <TouchableOpacity onPress={handlePress} hitSlop={12} style={style}>
      <Ionicons name={icon} size={size} color={color} />
    </TouchableOpacity>
  )
}

export const BackButton = React.memo(BackButtonComponent)
