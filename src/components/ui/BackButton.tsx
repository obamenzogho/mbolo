import React, { useCallback } from 'react'
import { TouchableOpacity, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

interface BackButtonProps {
  icon?: keyof typeof Ionicons.glyphMap
  size?: number
  color?: string
  style?: ViewStyle
  onPress?: () => void
  fallbackRoute?: string
}

function BackButtonComponent({ icon = 'close', size = 28, color = '#fff', style, onPress, fallbackRoute }: BackButtonProps) {
  const router = useRouter()

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress()
    } else if (fallbackRoute) {
      router.replace(fallbackRoute as any)
    } else {
      try { router.back() } catch {}
    }
  }, [onPress, router, fallbackRoute])

  return (
    <TouchableOpacity onPress={handlePress} style={[{ padding: 4 }, style]} activeOpacity={0.7}>
      <Ionicons name={icon} size={size} color={color} />
    </TouchableOpacity>
  )
}

export const BackButton = React.memo(BackButtonComponent)
