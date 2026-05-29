import { memo, useCallback, useRef } from 'react'
import { TouchableOpacity, Text, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useHaptics } from '@/hooks/useHaptics'

interface ShareButtonProps {
  onPress: () => void
  size?: number
  showLabel?: boolean
  count?: number
}

function ShareButtonComponent({ onPress, size = 28, showLabel = true, count }: ShareButtonProps) {
  const { lightImpact } = useHaptics()
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handlePress = useCallback(() => {
    lightImpact()
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 6 }),
    ]).start()
    onPress()
  }, [lightImpact, onPress, scaleAnim])

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons name="paper-plane-outline" size={size} color="#FFF" />
      </Animated.View>
      {showLabel && (
        <Text style={{
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 2,
        }}>
          {count != null && count > 0 ? (count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count) : 'Partager'}
        </Text>
      )}
    </TouchableOpacity>
  )
}

export const ShareButton = memo(ShareButtonComponent)
