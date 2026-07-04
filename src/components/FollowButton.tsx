import { useRef, useCallback } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native'
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

  const isActive = isFollowing || isRequested

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
        <Text style={[styles.label, isActive && styles.activeLabel]}>
          {isFollowing ? t.follow.following : isRequested ? t.follow.requested : t.follow.follow}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  button: { borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  sm: { height: 27, paddingHorizontal: 10 },
  md: { height: 32, paddingHorizontal: 14 },
  notFollowing: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  requested: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  following: { backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.white, fontWeight: '700', fontSize: 12 },
  activeLabel: { color: colors.textSecondary },
})
