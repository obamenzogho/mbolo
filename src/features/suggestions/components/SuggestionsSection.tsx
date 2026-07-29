import { memo, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'
import { SuggestedUserCard } from './SuggestedUserCard'
import { ShimmerBlock } from '@/features/news/components/Skeletons'
import type { FollowSuggestion } from '../types'

interface SuggestionsSectionProps {
  title: string
  suggestions: FollowSuggestion[]
  loading?: boolean
  onDismiss?: (userId: string) => void
  onViewAll?: () => void
  compact?: boolean
  carousel?: boolean
  error?: Error | null
}

function SuggestionsSectionInner({
  title,
  suggestions,
  loading = false,
  onDismiss,
  onViewAll,
  compact = false,
  carousel = false,
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
        carousel ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselScroll}
          >
            {Array.from({ length: 2 }).map((_, i) => (
              <View key={i} style={styles.skeletonCarousel}>
                <ShimmerBlock style={{ width: 64, height: 64, borderRadius: 32 }} />
                <ShimmerBlock style={{ width: 90, height: 12, borderRadius: 6 }} />
                <ShimmerBlock style={{ width: 60, height: 10, borderRadius: 5 }} />
              </View>
            ))}
          </ScrollView>
        ) : compact ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.compactScroll}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <View key={i} style={styles.skeletonCompact}>
                <ShimmerBlock style={{ width: 48, height: 48, borderRadius: 24 }} />
                <ShimmerBlock style={{ width: 80, height: 10, borderRadius: 5 }} />
                <ShimmerBlock style={{ width: 60, height: 10, borderRadius: 5 }} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.skeletonContainer}>
            {Array.from({ length: 2 }).map((_, i) => (
              <View key={i} style={styles.skeletonCard}>
                <ShimmerBlock style={styles.skeletonAvatar} />
                <View style={{ gap: 4, flex: 1 }}>
                  <ShimmerBlock style={{ width: '60%', height: 10, borderRadius: 5 }} />
                  <ShimmerBlock style={{ width: '40%', height: 10, borderRadius: 5 }} />
                </View>
              </View>
            ))}
          </View>
        )
      ) : carousel ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselScroll}
          decelerationRate="fast"
          snapToInterval={172}
          snapToAlignment="start"
        >
          {suggestions.map((s) => (
            <SuggestedUserCard
              key={s.id}
              suggestion={s}
              onDismiss={handleDismiss}
              carousel
            />
          ))}
        </ScrollView>
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
    color: colors.textPrimary,
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
  carouselScroll: {
    paddingLeft: 16,
    paddingRight: 4,
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
  skeletonCarousel: {
    width: 152,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 12,
    marginRight: 12,
    gap: 10,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
