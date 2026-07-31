import { memo } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { colors } from '@/lib/theme'
import { formatCount } from '@/hooks/useComments'
import FollowButton from '@/components/FollowButton'
import { HighlightedText } from './HighlightedText'
import type { UserResult } from '@/services/searchService'

interface UserResultCardProps {
  user: UserResult
  onPress?: () => void
  term?: string
}

export const UserResultCard = memo(function UserResultCard({ user, onPress, term }: UserResultCardProps) {
  return (
    <TouchableOpacity
      onPress={() => { onPress?.(); router.push({ pathname: '/user/[userId]', params: { userId: user.id } }) }}
      style={styles.card}
      activeOpacity={0.7}
    >
      {user.photoURL ? (
        <Image source={{ uri: user.photoURL }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.fallback]}>
          <Ionicons name="person" size={22} color="#888" />
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <HighlightedText
            text={`@${user.pseudo || 'utilisateur'}`}
            term={term ?? ''}
            style={styles.pseudo}
            numberOfLines={1}
          />
          {user.verified && (
            <Ionicons name="checkmark-circle" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
          )}
        </View>
        {user.nom ? <Text style={styles.nom} numberOfLines={1}>{user.nom}</Text> : null}
        {user.bio ? <Text style={styles.bio} numberOfLines={1}>{user.bio}</Text> : null}
        {(user.followerCount ?? 0) > 0 && (
          <Text style={styles.followers}>{formatCount(user.followerCount)} abonné{(user.followerCount ?? 0) > 1 ? 's' : ''}</Text>
        )}
      </View>
      <FollowButton targetUserId={user.id} size="sm" style={styles.followBtn} />
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  fallback: { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  pseudo: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  nom: { color: colors.textSecondary, fontSize: 13, marginTop: 1 },
  bio: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  followers: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  followBtn: { marginLeft: 4 },
})
