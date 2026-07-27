import { Modal, View, Text, TouchableOpacity, Animated, Easing } from 'react-native'
import { useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

export interface SettingsOption<T extends string | number> {
  value: T
  label: string
  description?: string
}

interface SettingsOptionSheetProps<T extends string | number> {
  visible: boolean
  title: string
  options: SettingsOption<T>[]
  selected: T
  onSelect: (value: T) => void
  onClose: () => void
}

/**
 * Feuille de sélection à valeur unique, dans le style des menus MBolo
 * (slide bottom, overlay, coche verte sur l'option active).
 */
export function SettingsOptionSheet<T extends string | number>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: SettingsOptionSheetProps<T>) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [visible, anim])

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{ flex: 1, backgroundColor: colors.overlay }}
        />
        <Animated.View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: 34,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
          }}
        >
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
          <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
            {title}
          </Text>
          {options.map((opt) => {
            const active = opt.value === selected
            return (
              <TouchableOpacity
                key={String(opt.value)}
                onPress={() => { onSelect(opt.value); onClose() }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.white, fontSize: 15 }}>{opt.label}</Text>
                  {opt.description ? (
                    <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{opt.description}</Text>
                  ) : null}
                </View>
                {active ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : null}
              </TouchableOpacity>
            )
          })}
        </Animated.View>
      </View>
    </Modal>
  )
}
