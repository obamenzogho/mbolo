import React, { useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { useHaptics } from '../../hooks/useHaptics'

interface CreateOptionProps {
  icon: string
  label: string
  index: number
  onPress: () => void
}

function CreateOptionComponent({ icon, label, onPress }: CreateOptionProps) {
  const { lightImpact } = useHaptics()

  const handlePress = useCallback(() => {
    lightImpact()
    onPress()
  }, [onPress, lightImpact])

  return (
    <Pressable onPress={handlePress}>
      <View style={{
        width: 80, height: 90,
        alignItems: 'center', justifyContent: 'center',
        gap: 6,
      }}>
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
      </View>
    </Pressable>
  )
}

export default React.memo(CreateOptionComponent)
