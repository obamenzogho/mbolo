import { useCallback } from 'react'
import {
  View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useFollowSuggestions } from '@/features/suggestions/hooks/useFollowSuggestions'
import { useInterestGraph } from '@/features/suggestions/hooks/useInterestGraph'
import { SuggestionsSection } from '@/features/suggestions/components/SuggestionsSection'
import PageWrapper from '@/components/PageWrapper'
import OrbitLoader from '@/components/OrbitLoader'
import { colors } from '@/lib/theme'

export default function Discover() {
  const {
    suggestions,
    trending,
    loading,
    refreshing,
    refresh,
    dismissSuggestion,
  } = useFollowSuggestions({ autoRefresh: true })

  const { topCategories, loading: interestsLoading } = useInterestGraph()

  const handleRefresh = useCallback(() => {
    refresh()
  }, [refresh])

  const handleBack = useCallback(() => {
    router.navigate('/(tabs)/feed')
  }, [])

  if (loading && suggestions.length === 0) {
    return (
      <PageWrapper type="fadeSlide" style={{ backgroundColor: '#000' }}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={26} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Découvrir</Text>
          </View>
          <View style={styles.loadingContainer}>
            <OrbitLoader size={80} />
          </View>
        </SafeAreaView>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper type="fadeSlide" style={{ backgroundColor: '#000' }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Découvrir</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {!interestsLoading && topCategories.length > 0 && (
            <View style={styles.interestsSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="options-outline" size={16} color={colors.primary} />
                <Text style={styles.sectionTitle}>Tes centres d'intérêt</Text>
              </View>
              <View style={styles.chipRow}>
                {topCategories.map((cat) => (
                  <View key={cat} style={styles.chip}>
                    <Text style={styles.chipText}>{cat}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {trending.length > 0 && (
            <SuggestionsSection
              title="Créateurs tendance"
              suggestions={trending}
              compact
            />
          )}

          <View style={styles.youMightLike}>
            <SuggestionsSection
              title="Suggestions pour toi"
              suggestions={suggestions}
              loading={loading && suggestions.length === 0}
              onDismiss={dismissSuggestion}
            />
          </View>

          {!loading && suggestions.length === 0 && trending.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>Aucune suggestion</Text>
              <Text style={styles.emptySubtitle}>
                Reviens plus tard, de nouveaux créateurs t'attendent
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </PageWrapper>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interestsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  youMightLike: {
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
})
