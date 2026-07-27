import { View, Text } from 'react-native'
import { colors } from '@/lib/theme'

interface SettingsSectionProps {
  title?: string
  footer?: string
  children: React.ReactNode
}

/**
 * Groupe de réglages : titre en capitales + carte arrondie sombre.
 * Reproduit le style historique de l'écran Paramètres (carte #111,
 * titre #888 uppercase) pour rester cohérent avec l'identité MBolo.
 */
export function SettingsSection({ title, footer, children }: SettingsSectionProps) {
  return (
    <View style={{ marginBottom: 24 }}>
      {title ? (
        <Text
          style={{
            color: '#888',
            fontSize: 13,
            fontWeight: '600',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {title}
        </Text>
      ) : null}
      <View style={{ backgroundColor: '#111', borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </View>
      {footer ? (
        <Text style={{ color: '#666', fontSize: 12, marginTop: 8, lineHeight: 17 }}>{footer}</Text>
      ) : null}
    </View>
  )
}
