import { View, Text, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../lib/theme'

type IconProps = {
  size?: number
  color?: string
  style?: ViewStyle
}

export function MboloLogo({ size = 80 }: { size?: number }) {
  const iconSize = size * 0.32
  const fontSize = size * 0.18
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.28,
        backgroundColor: colors.surface,
        borderWidth: 2, borderColor: colors.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 10,
      }}
    >
      <Ionicons name="planet" size={iconSize} color={colors.primary} style={{ marginBottom: 2 }} />
      <Text style={{ fontSize, fontWeight: '900', color: colors.primary, letterSpacing: 2.5 }}>
        Mbolo
      </Text>
    </View>
  )
}

export function EyeIcon({ size = 24, color = '#8B949E', style }: IconProps) {
  return <Ionicons name="eye-outline" size={size} color={color} style={style} />
}

export function EyeOffIcon({ size = 24, color = '#8B949E', style }: IconProps) {
  return <Ionicons name="eye-off-outline" size={size} color={color} style={style} />
}

export function LockIcon({ size = 20, color = '#8B949E', style }: IconProps) {
  return <Ionicons name="lock-closed-outline" size={size} color={color} style={style} />
}

export function UserIcon({ size = 20, color = '#8B949E', style }: IconProps) {
  return <Ionicons name="person-outline" size={size} color={color} style={style} />
}
