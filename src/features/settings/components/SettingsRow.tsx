import { View, Text, TouchableOpacity, Switch } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

type RowKind = 'action' | 'toggle' | 'value' | 'static'

interface SettingsRowProps {
  icon?: keyof typeof Ionicons.glyphMap
  label: string
  description?: string
  /** Sépare cette ligne de la suivante par une hairline. */
  divider?: boolean
  kind?: RowKind
  // action / value
  onPress?: () => void
  value?: string
  destructive?: boolean
  // toggle
  toggleValue?: boolean
  onToggle?: (next: boolean) => void
  disabled?: boolean
}

/**
 * Ligne de réglage unique. Gère les 4 variantes utilisées dans MBolo :
 * action (chevron), toggle (Switch), value (texte + chevron), static.
 * Style aligné sur l'écran Paramètres historique.
 */
export function SettingsRow({
  icon,
  label,
  description,
  divider = false,
  kind = 'action',
  onPress,
  value,
  destructive = false,
  toggleValue,
  onToggle,
  disabled = false,
}: SettingsRowProps) {
  const labelColor = destructive ? colors.error : colors.white
  const isPressable = kind !== 'toggle' && !!onPress && !disabled

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: divider ? 0.5 : 0,
        borderBottomColor: '#222',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={22}
          color={destructive ? colors.error : '#888'}
          style={{ marginRight: 14 }}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: labelColor, fontSize: 15 }}>{label}</Text>
        {description ? (
          <Text style={{ color: '#666', fontSize: 12, marginTop: 2, lineHeight: 16 }}>{description}</Text>
        ) : null}
      </View>

      {kind === 'toggle' ? (
        <Switch
          value={!!toggleValue}
          onValueChange={(v) => onToggle?.(v)}
          disabled={disabled}
          trackColor={{ false: '#333', true: colors.primary }}
          thumbColor="#fff"
        />
      ) : kind === 'value' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {value ? <Text style={{ color: '#888', fontSize: 14, marginRight: 6 }}>{value}</Text> : null}
          <Ionicons name="chevron-forward" size={18} color="#444" />
        </View>
      ) : kind === 'action' ? (
        <Ionicons name="chevron-forward" size={18} color="#444" />
      ) : null}
    </View>
  )

  if (isPressable) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    )
  }
  return content
}
