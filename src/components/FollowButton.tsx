import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useFollow } from '../hooks/useFollow'
import { colors } from '../lib/theme'

interface Props {
  targetUserId: string
  size?: 'sm' | 'md' | 'lg'
  style?: any
  initialFollowing?: boolean
  initialRequested?: boolean
}

export default function FollowButton({ targetUserId, size = 'md', style, initialFollowing, initialRequested }: Props) {
  const { isFollowing, isRequested, loading, toggleFollow } = useFollow(targetUserId, initialFollowing, initialRequested)

  if (loading) {
    return (
      <View style={[styles.button, size === 'sm' ? styles.sm : styles.md, style, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    )
  }

  const isActive = isFollowing || isRequested

  return (
    <TouchableOpacity
      style={[
        styles.button,
        size === 'sm' ? styles.sm : styles.md,
        style,
        isFollowing ? styles.following : isRequested ? styles.requested : styles.notFollowing,
      ]}
      onPress={toggleFollow}
    >
      <Text style={[styles.label, isActive && styles.activeLabel]}>
        {isFollowing ? 'Abonné' : isRequested ? 'Demande envoyée' : 'Suivre'}
      </Text>
    </TouchableOpacity>
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
