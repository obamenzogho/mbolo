import { memo, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { colors } from '@/lib/theme'
import { Avatar } from '@/components/ui/Avatar'
import FollowButton from '@/components/FollowButton'
import type { FollowSuggestion } from '../types'

interface SuggestedUserCardProps {
  suggestion: FollowSuggestion
  onDismiss?: (userId: string) => void
  onPress?: (userId: string) => void
  compact?: boolean
}

function SuggestedUserCardInner({
  suggestion,
  onDismiss,
  onPress,
  compact = false,
}: SuggestedUserCardProps) {
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(suggestion.id)
    } else {
      router.push({ pathname: '/user/[userId]', params: { userId: suggestion.id } })
    }
  }, [suggestion.id, onPress])

  const handleDismiss = useCallback(() => {
    if (onDismiss) onDismiss(suggestion.id)
  }, [suggestion.id, onDismiss])

  if (compact) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={styles.compactCard}
      >
        <Avatar
          uri={suggestion.user.photoURL}
          name={suggestion.user.nom}
          size={56}
        />
        {suggestion.user.verified && (
          <View style={styles.verifiedBadgeCompact}>
            <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />
          </View>
        )}
        <Text style={styles.compactName} numberOfLines={1}>
          {suggestion.user.pseudo}
        </Text>
        {suggestion.mutualCount > 0 && (
          <Text style={styles.compactMutual} numberOfLines={1}>
            {suggestion.mutualCount} abonné{suggestion.mutualCount > 1 ? 's' : ''} commun{suggestion.mutualCount > 1 ? 's' : ''}
          </Text>
        )}
        <FollowButton targetUserId={suggestion.id} size="sm" />
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={styles.card}
    >
      <View style={styles.cardRow}>
        <TouchableOpacity onPress={handlePress}>
          <Avatar
            uri={suggestion.user.photoURL}
            name={suggestion.user.nom}
            size={48}
          />
        </TouchableOpacity>

        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.nom} numberOfLines={1}>
              {suggestion.user.nom || suggestion.user.pseudo}
            </Text>
            {suggestion.user.verified && (
              <Ionicons name="checkmark-circle" size={14} color={colors.secondary} style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={styles.pseudo} numberOfLines={1}>
            @{suggestion.user.pseudo}
          </Text>
          {suggestion.user.bio ? (
            <Text style={styles.bio} numberOfLines={2}>
              {suggestion.user.bio}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.reasonLabel}>
              {suggestion.reasonLabel}
            </Text>
            {suggestion.user.followerCount > 0 && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.reasonLabel}>
                  {suggestion.user.followerCount >= 1000
                    ? `${(suggestion.user.followerCount / 1000).toFixed(1)}k abonnés`
                    : `${suggestion.user.followerCount} abonnés`}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.cardActions}>
          <FollowButton targetUserId={suggestion.id} size="md" />
          {onDismiss && (
            <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

export const SuggestedUserCard = memo(SuggestedUserCardInner)

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nom: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  pseudo: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 1,
  },
  bio: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  reasonLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  metaDot: {
    color: colors.textSecondary,
    fontSize: 11,
    marginHorizontal: 4,
  },
  cardActions: {
    alignItems: 'center',
    gap: 6,
  },
  dismissBtn: {
    padding: 4,
  },
  compactCard: {
    width: 130,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  verifiedBadgeCompact: {
    position: 'absolute',
    top: 12,
    right: 10,
  },
  compactName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  compactMutual: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
})
