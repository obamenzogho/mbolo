import { memo, useState, type ReactNode } from 'react'
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface Props {
  title: string
  icon: keyof typeof Ionicons.glyphMap
  defaultOpen?: boolean
  children: ReactNode
}

export const CollapsibleSection = memo(function CollapsibleSection({ title, icon, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen((p) => !p)
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.header}>
        <Ionicons name={icon} size={18} color={colors.secondary} />
        <Text style={styles.title}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  title: { flex: 1, color: colors.white, fontSize: 15, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
})
