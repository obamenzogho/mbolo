import { View, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Line, Rect } from 'react-native-svg'
import { colors } from '../lib/theme'

type IconProps = {
  size?: number
  color?: string
  style?: ViewStyle
}

export function MboloLogo({ size = 80 }: { size?: number }) {
  const stroke = size * 0.09
  const shadowOffset = size * 0.012
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size * 0.28,
        backgroundColor: colors.secondary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: colors.secondary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 10,
      }}
    >
      <Svg width={size * 0.74} height={size * 0.58} viewBox="0 0 100 78">
        <Rect x="4" y="4" width="92" height="70" rx="22" fill={colors.secondary} />
        <Line x1={24 + shadowOffset} y1={58 + shadowOffset} x2={24 + shadowOffset} y2={18 + shadowOffset} stroke={colors.background} strokeWidth={stroke} strokeLinecap="round" strokeOpacity={0.72} />
        <Line x1={24 + shadowOffset} y1={18 + shadowOffset} x2={50 + shadowOffset} y2={46 + shadowOffset} stroke={colors.background} strokeWidth={stroke} strokeLinecap="round" strokeOpacity={0.72} />
        <Line x1={50 + shadowOffset} y1={46 + shadowOffset} x2={76 + shadowOffset} y2={18 + shadowOffset} stroke={colors.background} strokeWidth={stroke} strokeLinecap="round" strokeOpacity={0.72} />
        <Line x1={76 + shadowOffset} y1={18 + shadowOffset} x2={76 + shadowOffset} y2={58 + shadowOffset} stroke={colors.background} strokeWidth={stroke} strokeLinecap="round" strokeOpacity={0.72} />
        <Line x1="24" y1="58" x2="24" y2="18" stroke={colors.primary} strokeWidth={stroke} strokeLinecap="round" />
        <Line x1="24" y1="18" x2="50" y2="46" stroke={colors.primary} strokeWidth={stroke} strokeLinecap="round" />
        <Line x1="50" y1="46" x2="76" y2="18" stroke={colors.primary} strokeWidth={stroke} strokeLinecap="round" />
        <Line x1="76" y1="18" x2="76" y2="58" stroke={colors.primary} strokeWidth={stroke} strokeLinecap="round" />
      </Svg>
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
