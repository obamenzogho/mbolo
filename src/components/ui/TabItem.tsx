import React, { useEffect } from 'react'
import { Pressable, Text, View, Image } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'

interface TabItemProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  isActive: boolean
  onPress: () => void
  badge?: number
  profilePhotoURL?: string | null
}

const ICON_SIZE = 26
const LABEL_SIZE = 11

const TabItem = React.memo(function TabItem({
  icon,
  label,
  isActive,
  onPress,
  badge,
  profilePhotoURL,
}: TabItemProps) {
  const pressScale = useSharedValue(1)
  const activeScale = useSharedValue(isActive ? 1.05 : 1)

  useEffect(() => {
    activeScale.value = withSpring(isActive ? 1.05 : 1, {
      stiffness: 200,
      damping: 12,
    })
  }, [isActive])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * activeScale.value }],
  }))

  const handlePress = () => {
    pressScale.value = withSequence(
      withSpring(0.92, { stiffness: 500, damping: 12 }),
      withSpring(1, { stiffness: 400, damping: 15 }),
    )
    onPress()
  }

  const iconColor = isActive ? colors.primary : colors.textSecondary
  const labelColor = isActive ? colors.primary : colors.textSecondary

  // Motif premium façon Facebook/Instagram : icône PLEINE sur l'onglet actif,
  // CONTOUR sur les onglets inactifs. Les noms de TAB_ICONS sont les variantes
  // pleines ; on ajoute « -outline » quand l'onglet est inactif, sauf si le nom
  // porte déjà le suffixe (robustesse) ou n'a pas de variante contour connue.
  const displayIcon: keyof typeof Ionicons.glyphMap = isActive
    ? icon
    : (icon.endsWith('-outline')
        ? icon
        : (`${icon}-outline` as keyof typeof Ionicons.glyphMap))

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 4,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Animated.View
        style={[{ alignItems: 'center', justifyContent: 'center' }, animatedStyle]}
      >
        <View>
          {profilePhotoURL ? (
            <Image
              source={{ uri: profilePhotoURL }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 2,
                borderColor: isActive ? colors.primary : 'transparent',
              }}
            />
          ) : (
            <Ionicons name={displayIcon} size={ICON_SIZE} color={iconColor} />
          )}
          {badge != null && badge > 0 && (
            <View style={{
              position: 'absolute', top: -8, right: -13,
              backgroundColor: colors.accent, borderRadius: 12,
              minWidth: 24, height: 24, paddingHorizontal: 5,
              borderWidth: 2, borderColor: '#0D1117',
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{ color: '#000', fontSize: 12, fontWeight: '800' }}>
                {badge > 99 ? '99+' : badge}
              </Text>
            </View>
          )}
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontSize: LABEL_SIZE,
            fontWeight: isActive ? '700' : '500',
            color: labelColor,
            marginTop: 4,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}, (prev, next) => {
  return (
    prev.isActive === next.isActive &&
    prev.icon === next.icon &&
    prev.label === next.label &&
    prev.badge === next.badge &&
    prev.profilePhotoURL === next.profilePhotoURL
  )
})

export default TabItem
