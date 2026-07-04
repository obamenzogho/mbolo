/* ProfileVideoViewer — Modal plein écran pour voir les vidéos d'un profil.
   Pool de players ISOLÉ (useVideoPlayerPool avec instanceId="profile-viewer"),
   currentIndex LOCAL (useProfileFeedData, pas le feedStore global).
   AppState gestion background/foreground avec pendingActivation LOCAL.
   useVisibleIndex réutilisé avec callbacks locaux. */

import { useState, useEffect, useCallback, useRef } from 'react'
import { View, FlatList, useWindowDimensions, Dimensions, StatusBar, Modal, TouchableOpacity, AppState } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FEED_DEBUG } from '../store/feedStore'
import { useVideoPlayerPool } from '../hooks/useVideoPlayerPool'
import { usePrefetch } from '../hooks/usePrefetch'
import { useVisibleIndex } from '../hooks/useVisibleIndex'
import { ProfileFeedItem } from './ProfileFeedItem'
import { useProfileFeedData } from './useProfileFeedData'
import CommentSheet from '../components/CommentSheet'
import ShareModal, { type ShareVideoData } from '../../../components/ShareModal'
import type { Video } from '../../../types'

interface ProfileVideoViewerProps {
  videos: Video[]
  initialIndex: number
  onClose: () => void
  userId: string
  isOwn?: boolean
  profileUser?: { nom?: string; photoURL?: string } | null
}

export function ProfileVideoViewer({
  videos, initialIndex, onClose, userId, isOwn, profileUser,
}: ProfileVideoViewerProps) {
  const insets = useSafeAreaInsets()
  const { currentIndex, setCurrentIndex, skipToNext } = useProfileFeedData({ videos, initialIndex })
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)
  const [shareData, setShareData] = useState<ShareVideoData | null>(null)
  const [pendingActivation, setPendingActivation] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const isScrollingRef = useRef(false)
  const { height: SCREEN_HEIGHT } = useWindowDimensions()

  const pool = useVideoPlayerPool('profile-viewer', skipToNext)
  const username = profileUser?.nom ?? userId

  usePrefetch(videos, currentIndex)

  const {
    onViewableItemsChanged,
    viewabilityConfig,
    handleScrollBeginDrag,
    handleMomentumScrollEnd,
  } = useVisibleIndex({
    index: currentIndex,
    onIndexChange: (i) => setCurrentIndex(i),
    onScrollBeginDrag: () => { isScrollingRef.current = true },
    onMomentumScrollEnd: () => { isScrollingRef.current = false },
  })

  useEffect(() => {
    if (videos.length > 0) {
      pool.syncPool(videos, currentIndex, isScrollingRef.current)
    }
  }, [currentIndex, videos, pool])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: string) => {
      if (state === 'background') {
        const player = pool.getPlayer(videos[currentIndex]?.id)
        if (player) {
          player.pause()
          if (FEED_DEBUG) console.log('[FEED_DEBUG] PROFILE_VIEWER: pause on background')
        }
      } else if (state === 'active') {
        setPendingActivation(true)
        pool.syncPool(videos, currentIndex, false)
        if (FEED_DEBUG) console.log('[FEED_DEBUG] PROFILE_VIEWER: resume on active')
      }
    })
    return () => sub.remove()
  }, [pool, currentIndex, videos])

  const sheetHeight = useSharedValue(0)
  const profileVideoAreaStyle = useAnimatedStyle(() => ({
    height: Dimensions.get('window').height - sheetHeight.value,
    overflow: 'hidden',
  }))

  const onPressComments = useCallback((videoId: string) => setCommentVideoId(videoId), [])
  const onCloseComments = useCallback(() => setCommentVideoId(null), [])
  const onOpenShare = useCallback((data: ShareVideoData) => setShareData(data), [])
  const onCloseShare = useCallback(() => setShareData(null), [])

  if (videos.length === 0) return null

  return (
    <Modal visible animationType="slide" statusBarTranslucent presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar hidden />

        <Animated.View style={[profileVideoAreaStyle]}>
          <FlatList
            ref={flatListRef}
            data={videos}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <ProfileFeedItem
                item={item}
                index={index}
                isActive={index === currentIndex}
                onPressComments={onPressComments}
                onOpenShare={onOpenShare}
                username={username}
                instanceId="profile-viewer"
              />
            )}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={SCREEN_HEIGHT}
            snapToAlignment="start"
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScrollBeginDrag={handleScrollBeginDrag}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({ length: SCREEN_HEIGHT, offset: SCREEN_HEIGHT * index, index })}
            windowSize={3}
            maxToRenderPerBatch={1}
            initialNumToRender={1}
            removeClippedSubviews={false}
            style={{ flex: 1 }}
          />
        </Animated.View>

        <TouchableOpacity
          onPress={onClose}
          style={{
            position: 'absolute', top: insets.top + 8, left: 16,
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center', alignItems: 'center',
            zIndex: 10,
          }}
        >
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>

        {commentVideoId && (
          <CommentSheet
            key={commentVideoId}
            videoId={commentVideoId}
            videoOwnerId={userId}
            isOwner={!!isOwn}
            onClose={onCloseComments}
            sheetHeight={sheetHeight}
          />
        )}
        <ShareModal
          visible={shareData !== null}
          onClose={onCloseShare}
          data={shareData as ShareVideoData}
        />
      </View>
    </Modal>
  )
}
