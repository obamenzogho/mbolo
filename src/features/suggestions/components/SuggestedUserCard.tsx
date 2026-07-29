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
  carousel?: boolean
}

function SuggestedUserCardInner({
  suggestion,
  onDismiss,
  onPress,
  compact = false,
  carousel = false,
}: SuggestedUserCardProps) {
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(suggestion.id)
    } else {
      router.push({ pathname: '/(tabs)/(sub)/user/[userId]', params: { userId: suggestion.id } })
    }
  }, [suggestion.id, onPress])

  const handleDismiss = useCallback(() => {
    if (onDismiss) onDismiss(suggestion.id)
  }, [suggestion.id, onDismiss])

  if (carousel) {
    return (
      <View style={styles.carouselCard}>
        {onDismiss && (
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.carouselDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.carouselTop}>
          <Avatar
            uri={suggestion.user.photoURL}
            name={suggestion.user.nom}
            size={72}
          />
          <View style={styles.carouselNameRow}>
            <Text style={styles.carouselName} numberOfLines={1}>
              {suggestion.user.nom || suggestion.user.pseudo}
            </Text>
            {suggestion.user.verified && (
              <Ionicons name="checkmark-circle" size={14} color={colors.secondary} style={{ marginLeft: 3 }} />
            )}
          </View>
          <Text style={styles.carouselPseudo} numberOfLines={1}>
            @{suggestion.user.pseudo}
          </Text>
          <Text style={styles.carouselMeta} numberOfLines={1}>
            {suggestion.mutualCount > 0
              ? `${suggestion.mutualCount} abonné${suggestion.mutualCount > 1 ? 's' : ''} commun${suggestion.mutualCount > 1 ? 's' : ''}`
              : suggestion.reasonLabel}
          </Text>
        </TouchableOpacity>

        <View style={styles.carouselAction}>
          <FollowButton targetUserId={suggestion.id} size="md" />
        </View>
      </View>
    )
  }

  if (compact) {
    const followerCount = suggestion.user.followerCount ?? 0
    return (
      <View style={styles.compactCard}>
        {onDismiss && (
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.compactDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={styles.compactContent}>
          <View style={{ position: 'relative' }}>
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
          </View>
          <Text style={styles.compactName} numberOfLines={1}>
            {suggestion.user.pseudo}
          </Text>
          {followerCount > 0 && (
            <Text style={styles.compactFollowers} numberOfLines={1}>
              {followerCount >= 1000
                ? `${(followerCount / 1000).toFixed(1)}k abonnés`
                : `${followerCount} abonné${followerCount > 1 ? 's' : ''}`}
            </Text>
          )}
          <FollowButton targetUserId={suggestion.id} size="sm" />
        </TouchableOpacity>
      </View>
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
            {(suggestion.user.followerCount ?? 0) > 0 && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.reasonLabel}>
                  {(suggestion.user.followerCount ?? 0) >= 1000
                    ? `${((suggestion.user.followerCount ?? 0) / 1000).toFixed(1)}k abonnés`
                    : `${suggestion.user.followerCount ?? 0} abonnés`}
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
    color: colors.textPrimary,
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
    backgroundColor: '#000',
    borderRadius: 10,
  },
  compactCard: {
    width: 140,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  compactDismiss: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    padding: 4,
    backgroundColor: '#000',
    borderRadius: 10,
  },
  compactContent: {
    alignItems: 'center',
  },
  verifiedBadgeCompact: {
    position: 'absolute',
    top: 12,
    right: 10,
  },
  compactName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  compactFollowers: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
    marginBottom: 4,
    textAlign: 'center',
  },
  compactMutual: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  // Carte rectangulaire « à la Facebook » pour le carrousel horizontal.
  carouselCard: {
    width: 160,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    paddingTop: 22,
    paddingBottom: 14,
    paddingHorizontal: 12,
    marginRight: 12,
    alignItems: 'center',
  },
  carouselDismiss: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    padding: 4,
    backgroundColor: '#000',
    borderRadius: 10,
  },
  carouselTop: {
    alignItems: 'center',
    width: '100%',
  },
  carouselNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    maxWidth: '100%',
  },
  carouselName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  carouselPseudo: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  carouselMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  carouselAction: {
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
})
