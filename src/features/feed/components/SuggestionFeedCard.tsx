import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Dimensions, ScrollView, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { VideoView } from 'expo-video'
import { router } from 'expo-router'
import { SuggestedUserCard } from '@/features/suggestions/components/SuggestedUserCard'
import { Avatar } from '@/components/ui/Avatar'
import FollowButton from '@/components/FollowButton'
import { usePlayerForVideo } from './VideoPlayerSlot'
import { colors } from '@/lib/theme'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { captureException } from '@/lib/sentry'
import type { FollowSuggestion } from '@/features/suggestions/types'

const { height: MODULE_SCREEN_HEIGHT, width: MODULE_SCREEN_WIDTH } = Dimensions.get('window')

interface SuggestionFeedCardProps {
  suggestions: FollowSuggestion[]
  onDismiss: (id: string) => void
  horizontal?: boolean
  nextVideoId?: string
  instanceId?: string
}

function SuggestionFeedCardInner({ suggestions, onDismiss, horizontal = false, nextVideoId, instanceId = 'feed' }: SuggestionFeedCardProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const bounceAnim = useRef(new Animated.Value(0)).current
  const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = useWindowDimensions()

  const player = usePlayerForVideo(instanceId, nextVideoId ?? '')

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    getDoc(doc(db, 'users', uid))
      .then((snap) => {
        if (snap.exists()) setFollowingIds(snap.data().following || [])
      })
      .catch((e) => captureException(e instanceof Error ? e : new Error(String(e)), { context: 'SuggestionFeedCardInner' }))
  }, [])

  const filteredSuggestions = suggestions.filter((s) => !followingIds.includes(s.id))

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -10, duration: 800, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [bounceAnim])

  const handleSeeAll = useCallback(() => {
    router.push('/(tabs)/discover')
  }, [])

  const handlePageChange = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x
    const page = Math.round(offsetX / SCREEN_WIDTH)
    setCurrentPage(page)
  }, [])

  if (horizontal && filteredSuggestions.length > 0) {
    return (
      <View style={[styles.hContainer, { height: SCREEN_HEIGHT }]}>
        <View style={styles.hTopSection}>
          <View style={styles.hHeader}>
            <Text style={styles.hTitle}>Suggestions pour toi</Text>
            <TouchableOpacity onPress={handleSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.seeAll}>Tout voir</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePageChange}
            bounces={false}
            style={styles.hScrollArea}
          >
            {filteredSuggestions.map((suggestion) => (
              <SuggestionItem key={suggestion.id} suggestion={suggestion} onDismiss={onDismiss} />
            ))}
          </ScrollView>

          <View style={styles.dotsRow}>
            {filteredSuggestions.slice(0, 10).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentPage && styles.dotActive]}
              />
            ))}
            {filteredSuggestions.length > 10 && (
              <Text style={styles.dotsMore}>+{filteredSuggestions.length - 10}</Text>
            )}
          </View>
        </View>

        <View style={styles.hBottomPreview}>
          {player && nextVideoId && (
            <VideoView
              key={nextVideoId}
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.hPreviewOverlay}>
            <Animated.View style={[styles.hPreviewSwipe, { transform: [{ translateY: bounceAnim }] }]}>
              <Text style={styles.hPreviewSwipeText}>Glisse vers le haut</Text>
              <Ionicons name="chevron-up" size={14} color="#fff" />
            </Animated.View>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { height: SCREEN_HEIGHT }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="people" size={20} color={colors.secondary} />
          <Text style={styles.title}>Suggestions pour toi</Text>
        </View>
        <TouchableOpacity onPress={handleSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.seeAll}>Tout voir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {filteredSuggestions.slice(0, 4).map((suggestion) => (
          <SuggestedUserCard
            key={suggestion.id}
            suggestion={suggestion}
            onDismiss={onDismiss}
          />
        ))}
      </ScrollView>
    </View>
  )
}

export const SuggestionFeedCard = memo(SuggestionFeedCardInner)

const SuggestionItem = memo(function SuggestionItem({ suggestion, onDismiss }: { suggestion: FollowSuggestion; onDismiss: (id: string) => void }) {
  return (
    <View style={styles.hPage}>
      <TouchableOpacity
        onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: suggestion.id } })}
        activeOpacity={0.8}
      >
        <View>
          <Avatar
            uri={suggestion.user.photoURL}
            name={suggestion.user.nom}
            size={110}
          />
          {suggestion.user.verified && (
            <View style={styles.hVerifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
            </View>
          )}
        </View>
      </TouchableOpacity>

      <Text style={styles.hName} numberOfLines={1}>
        {suggestion.user.nom || suggestion.user.pseudo}
      </Text>

      <Text style={styles.hPseudo} numberOfLines={1}>
        @{suggestion.user.pseudo}
      </Text>

      {suggestion.user.bio ? (
        <Text style={styles.hBio} numberOfLines={2}>
          {suggestion.user.bio}
        </Text>
      ) : null}

      <View style={styles.hMeta}>
        {suggestion.mutualCount > 0 && (
          <Text style={styles.hMetaText}>
            {suggestion.mutualCount} abonné{suggestion.mutualCount > 1 ? 's' : ''} commun{suggestion.mutualCount > 1 ? 's' : ''}
          </Text>
        )}
        {suggestion.mutualCount > 0 && suggestion.reasonLabel ? (
          <Text style={styles.hMetaDot}>·</Text>
        ) : null}
        {suggestion.reasonLabel ? (
          <Text style={styles.hMetaText}>{suggestion.reasonLabel}</Text>
        ) : null}
      </View>

      <View style={styles.hFollowerRow}>
        <Ionicons name="people-outline" size={12} color={colors.textSecondary} />
        <Text style={styles.hFollowerText}>
          {(suggestion.user.followerCount ?? 0) === 0
            ? 'Aucun abonné'
            : (suggestion.user.followerCount ?? 0) >= 1000
              ? `${((suggestion.user.followerCount ?? 0) / 1000).toFixed(1)}k`
              : `${suggestion.user.followerCount ?? 0} abonnés`}
        </Text>
      </View>

      <View style={styles.hActions}>
        <View style={{ flex: 1 }}>
          <FollowButton targetUserId={suggestion.id} size="md" style={{ borderColor: '#FFD700' }} />
        </View>
        <TouchableOpacity onPress={() => onDismiss(suggestion.id)} style={styles.hDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.hDismissText}>Ignorer</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
    paddingTop: 80,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  seeAll: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  hContainer: {
    flex: 1,
    backgroundColor: colors.black,
  },
  hTopSection: {
    flex: 0.58,
    backgroundColor: colors.black,
    paddingTop: MODULE_SCREEN_HEIGHT * 0.15,
    paddingBottom: 8,
  },
  hHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  hTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  hScrollArea: {
    flex: 1,
    marginTop: 12,
  },
  hPage: {
    width: MODULE_SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  hVerifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -6,
  },
  hName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  hPseudo: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  hBio: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 20,
  },
  hMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  hMetaText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  hMetaDot: {
    color: colors.textSecondary,
    fontSize: 11,
    marginHorizontal: 4,
  },
  hFollowerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  hFollowerText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  hActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
    paddingHorizontal: 20,
  },
  hDismiss: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  hDismissText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.textSecondary,
    opacity: 0.4,
  },
  dotActive: {
    width: 16,
    opacity: 1,
    backgroundColor: colors.secondary,
    borderRadius: 2.5,
  },
  dotsMore: {
    color: colors.textSecondary,
    fontSize: 10,
    marginLeft: 4,
  },
  hBottomPreview: {
    flex: 0.42,
    overflow: 'hidden',
  },
  hPreviewOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 70,
  },
  hPreviewSwipe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hPreviewSwipeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
})
