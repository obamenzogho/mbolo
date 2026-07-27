import { useRef, useCallback } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useFollow } from '../hooks/useFollow'
import OrbitLoader from './OrbitLoader'
import { colors } from '../lib/theme'
import { useI18n } from '../i18n'

interface Props {
  targetUserId: string
  size?: 'sm' | 'md' | 'lg'
  style?: any
  initialFollowing?: boolean
  initialRequested?: boolean
}

export default function FollowButton({ targetUserId, size = 'md', style, initialFollowing, initialRequested }: Props) {
  const { isFollowing, isRequested, loading, toggleFollow } = useFollow(targetUserId, initialFollowing, initialRequested)
  const scaleAnim = useRef(new Animated.Value(1)).current
  const { t } = useI18n()

  const handlePress = useCallback(async () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start()

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    toggleFollow()
  }, [toggleFollow, scaleAnim])

  if (loading) {
    return (
      <View style={[styles.button, size === 'sm' ? styles.sm : styles.md, style, { justifyContent: 'center', alignItems: 'center' }]}>
        <OrbitLoader size={size === 'sm' ? 14 : 18} />
      </View>
    )
  }

  const iconName = isFollowing ? 'checkmark' : isRequested ? 'person-add' : 'add'
  const iconSize = size === 'sm' ? 13 : 15

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.button,
          size === 'sm' ? styles.sm : styles.md,
          isFollowing ? styles.following : isRequested ? styles.requested : styles.notFollowing,
          style,
        ]}
        onPress={handlePress}
      >
        <Ionicons
          name={iconName}
          size={iconSize}
          color={isFollowing ? colors.textSecondary : '#000'}
        />
        <Text style={[styles.label, isFollowing && styles.followingLabel]}>
          {isFollowing ? t.follow.following : isRequested ? t.follow.requested : t.follow.follow}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 14,
  },
  sm: { height: 27, paddingHorizontal: 10 },
  md: { height: 32, paddingHorizontal: 14 },
  notFollowing: { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.border },
  requested: { backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.border },
  following: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  label: { color: '#000', fontWeight: '700', fontSize: 12 },
  followingLabel: { color: colors.textSecondary },
})
