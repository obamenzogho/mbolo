import { memo, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'
import { SuggestedUserCard } from './SuggestedUserCard'
import type { FollowSuggestion } from '../types'

interface SuggestionsSectionProps {
  title: string
  suggestions: FollowSuggestion[]
  loading?: boolean
  onDismiss?: (userId: string) => void
  onViewAll?: () => void
  compact?: boolean
  error?: Error | null
}

function SuggestionsSectionInner({
  title,
  suggestions,
  loading = false,
  onDismiss,
  onViewAll,
  compact = false,
  error,
}: SuggestionsSectionProps) {
  if (!loading && suggestions.length === 0 && !error) return null

  const handleDismiss = useCallback((userId: string) => {
    if (onDismiss) onDismiss(userId)
  }, [onDismiss])

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onViewAll && suggestions.length > 0 && (
          <TouchableOpacity onPress={onViewAll} style={styles.viewAllBtn}>
            <Text style={styles.viewAllText}>Tout voir</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && suggestions.length === 0 ? (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: compact ? 3 : 2 }).map((_, i) => (
            <View
              key={i}
              style={[
                compact ? styles.skeletonCompact : styles.skeletonCard,
                { opacity: 1 - i * 0.15 },
              ]}
            >
              <View style={[styles.skeletonAvatar, compact && { width: 48, height: 48, borderRadius: 24 }]} />
              <View style={{ gap: 4, flex: 1 }}>
                <View style={[styles.skeletonLine, { width: '60%' }]} />
                <View style={[styles.skeletonLine, { width: '40%' }]} />
              </View>
            </View>
          ))}
        </View>
      ) : compact ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.compactScroll}
          decelerationRate="fast"
          snapToInterval={140}
        >
          {suggestions.map((s) => (
            <SuggestedUserCard
              key={s.id}
              suggestion={s}
              onDismiss={handleDismiss}
              compact
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.listContainer}>
          {suggestions.map((s) => (
            <SuggestedUserCard
              key={s.id}
              suggestion={s}
              onDismiss={handleDismiss}
            />
          ))}
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
          <Text style={styles.errorText}>Erreur de chargement des suggestions</Text>
        </View>
      )}
    </View>
  )
}

export const SuggestionsSection = memo(SuggestionsSectionInner)

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  viewAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  viewAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  compactScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 8,
  },
  listContainer: {
    gap: 0,
  },
  skeletonContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  skeletonCompact: {
    width: 130,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginRight: 10,
    gap: 8,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceLight,
  },
  skeletonLine: {
    height: 10,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 6,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },
})
