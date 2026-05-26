import { memo, useCallback, useRef, useEffect, useState } from 'react'
import { View, FlatList, Text, Dimensions, Image, ScrollView, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { colors } from '../../../lib/theme'
import { useVideoFeed } from '../hooks/useVideoFeed'
import { useVideoAutoplay } from '../hooks/useVideoAutoplay'
import { VideoItem } from './VideoItem'
import OrbitLoader from '../../../components/OrbitLoader'
import FollowButton from '../../../components/FollowButton'
import { Avatar } from '../../../components/ui/Avatar'
import { router } from 'expo-router'
import { auth, db } from '../../../lib/firebase'
import { getDoc, doc } from 'firebase/firestore'
import type { Video as VideoType } from '../../../types'
import type { ShareVideoData } from '../../../components/ShareModal'
import type { FeedMode } from '../hooks/useVideoFeed'
import type { User } from '../../../types'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const PULL_THRESHOLD = 80

interface FeedPageProps {
  mode: FeedMode
  isPageActive: boolean
  isTabFocused: boolean
  clearToken: number
  onReady: (mode: FeedMode) => void
  onPressComments: (videoId: string) => void
  onOpenShare: (data: ShareVideoData) => void
  suggestedUsers: User[]
  suggestionsLoading: boolean
}

function FeedPageComponent({
  mode, isPageActive, isTabFocused, clearToken, onReady,
  onPressComments, onOpenShare,
  suggestedUsers, suggestionsLoading,
}: FeedPageProps) {
  const {
    videos, userMap, videoCounts, currentIndex, setCurrentIndex,
    loading, refreshStatus, refresh,
    updatePosition, hasMore, contentReady,
    clearSeenAndRefresh,
    error,
  } = useVideoFeed(10, mode)

  const currentUid = auth.currentUser?.uid
  const filteredSuggestions = currentUid
    ? suggestedUsers.filter(u => u.id !== currentUid)
    : suggestedUsers
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [loadingReady, setLoadingReady] = useState(false)
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())
  const [requestedSet, setRequestedSet] = useState<Set<string>>(new Set())
  const [followingReady, setFollowingReady] = useState(false)

  useEffect(() => {
    if (!currentUid) return
    const fetchFollowing = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', currentUid))
        if (snap.exists()) {
          setFollowingSet(new Set(snap.data().following || []))
          setRequestedSet(new Set(snap.data().pendingFollowings || []))
        }
      } catch (e) {
        console.error('Failed to fetch following:', e)
      }
      setFollowingReady(true)
    }
    fetchFollowing()
  }, [currentUid])

  const allReady = contentReady && videos.length > 0 && userMap.size > 0 && (!currentUid || followingReady)

  useEffect(() => {
    if (allReady) setLoadingReady(true)
  }, [allReady])

  useEffect(() => {
    if (videos.length === 0) setLoadingReady(false)
  }, [videos.length])

  useEffect(() => {
    if (clearToken === 0) return
    clearSeenAndRefresh()
  }, [clearToken, clearSeenAndRefresh])

  const flatListRef = useRef<FlatList>(null)
  const pullDistSV = useSharedValue(0)
  const refreshActiveSV = useSharedValue(0)
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const hasSignaledReady = useRef(false)
  const savedPosRef = useRef<Record<string, number>>({})

  useEffect(() => {
    refreshActiveSV.value = refreshStatus !== 'idle' ? 1 : 0
  }, [refreshStatus, refreshActiveSV])

  useEffect(() => {
    if (hasSignaledReady.current) return
    if (allReady) {
      hasSignaledReady.current = true
      onReady(mode)
    }
  }, [allReady, mode, onReady])

  const { viewabilityConfig, onViewableItemsChanged } = useVideoAutoplay(setCurrentIndex, 0.6, 100)

  const pullIndicatorStyle = useAnimatedStyle(() => ({
    opacity: pullDistSV.value > 5 || refreshActiveSV.value === 1 ? 1 : 0,
  }))

  const handleScroll = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y
    pullDistSV.value = y < 0 ? Math.round(-y) : 0
  }, [pullDistSV])

  const handleScrollEndDrag = useCallback((event: any) => {
    const y = event.nativeEvent.contentOffset.y
    if (y < -PULL_THRESHOLD) {
      pullDistSV.value = 0
      refreshRef.current()
    }
  }, [pullDistSV])

  const renderItem = useCallback(({ item, index }: { item: VideoType; index: number }) => {
    const counts = videoCounts.get(item.id)
    const userInfo = userMap.get(item.userId)

    return (
      <VideoItem
        item={item}
        isActive={contentReady && index === currentIndex}
        isTabFocused={isTabFocused}
        isPageActive={isPageActive}
        onPressComments={() => onPressComments(item.id)}
        onOpenShare={onOpenShare}
        savedPosition={savedPosRef.current[item.id] || 0}
        onPositionUpdate={(pos: number) => {
          savedPosRef.current[item.id] = pos
          updatePosition(item.id, pos)
        }}
        username={userInfo?.nom ?? ''}
        photoURL={userInfo?.photoURL ?? ''}
        hasUnseenStory={false}
        initialFollowing={followingSet.has(item.userId)}
        initialRequested={requestedSet.has(item.userId)}
        initialCounts={{
          liked: counts?.liked ?? false,
          saved: counts?.saved ?? false,
          likes: counts?.likes ?? item.likes ?? 0,
          saves: counts?.saves ?? item.saves ?? 0,
          comments: counts?.comments ?? item.comments ?? 0,
          shares: counts?.shares ?? item.shares ?? 0,
        }}
      />
    )
  }, [currentIndex, isTabFocused, isPageActive, videoCounts, userMap, contentReady, onPressComments, onOpenShare, updatePosition, followingSet, requestedSet])

  const keyExtractor = useCallback((item: VideoType) => item.id, [])

  const listFooter = useCallback(() => {
    if (!hasMore) {
      return (
        <View style={{ height: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.black }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>— Plus aucune vidéo —</Text>
        </View>
      )
    }
    return null
  }, [hasMore])

  if (error && videos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(248, 81, 49, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Ionicons name="alert-circle" size={40} color={colors.error} />
        </View>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
          Oups, une erreur est survenue
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
          {error.message}
        </Text>
        <TouchableOpacity
          onPress={() => {
            hasSignaledReady.current = false
            clearSeenAndRefresh()
          }}
          style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
        >
          <Text style={{ color: colors.white, fontWeight: '700', fontSize: 14 }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (videos.length === 0) {
    if (loading) {
      return <View style={{ flex: 1, backgroundColor: colors.black }} />
    }
    if (mode === 'suivi') {
      return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ flex: 1, paddingTop: 90, paddingBottom: 40 }}>
            {!suggestionsLoading && filteredSuggestions.length > 0 && (
              <View style={{ paddingLeft: 16 }}>
                <TouchableOpacity
                  onPress={() => setShowSuggestions(s => !s)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>
                    Suggestions
                  </Text>
                  <Ionicons
                    name={showSuggestions ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
                {showSuggestions && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 16 }}>
                    {filteredSuggestions.map((user) => (
                      <TouchableOpacity
                        key={user.id}
                        onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: user.id } })}
                        style={{ alignItems: 'center', width: 84, height: 125 }}
                      >
                        <Avatar
                          uri={user.photoURL}
                          name={user.nom || user.pseudo}
                          size={72}
                          borderWidth={2}
                          borderColor={colors.primary}
                        />
                        <Text numberOfLines={1} style={{ color: colors.white, fontSize: 15, fontFamily: 'Georgia', marginTop: 6, textAlign: 'center', height: 20, lineHeight: 20 }}>
                          {user.nom || user.pseudo}
                        </Text>
                        <FollowButton targetUserId={user.id} size="sm" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
              <OrbitLoader size={80} />
              <Text style={{ color: colors.textSecondary, fontSize: 18, marginTop: 16, textAlign: 'center' }}>
                Tu ne suis personne encore
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                Explore pour trouver des créateurs
              </Text>
            </View>
          </ScrollView>
        </View>
      )
    }
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
        <Text style={{ color: colors.textSecondary, fontSize: 18, marginTop: 16, textAlign: 'center' }}>
          Aucune vidéo{'\n'}Sois le premier à poster
        </Text>
      </View>
    )
  }

  if (!loadingReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        {videos[0]?.thumbnailURL && (
          <Image source={{ uri: videos[0].thumbnailURL }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        )}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
          <OrbitLoader size={80} />
        </View>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged as any}
        viewabilityConfig={viewabilityConfig}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
        overScrollMode="always"
        bounces
        windowSize={5}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        removeClippedSubviews={true}
        ListFooterComponent={listFooter}
      />
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', top: 60, left: 0, right: 0, zIndex: 50,
        alignItems: 'center', paddingVertical: 8,
      }, pullIndicatorStyle]}>
        {refreshStatus === 'empty' ? (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Aucune nouvelle vidéo
            </Text>
          </View>
        ) : (
          <OrbitLoader size={44} />
        )}
      </Animated.View>
    </View>
  )
}

export const FeedPage = memo(FeedPageComponent)
