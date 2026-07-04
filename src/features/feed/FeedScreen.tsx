/* FeedScreen — page orchestrateur du feed vertical TikTok-like.
   Rôle : monte tous les hooks (useFeedData/useFollowingFeedData, useVideoPlayerPool),
   initialise VideoCache.warm(), rend FeedList.
   Générique : prend feedType pour sélectionner le store.
   Gère AppState et isActive (pause/reprise du player). */

import { useEffect, useCallback, useRef, useState } from 'react'
import { View, AppState } from 'react-native'
import { useStore } from 'zustand'
import { useFocusEffect } from '@react-navigation/native'
import BottomSheet from '@gorhom/bottom-sheet'
import { useTabBarVisibility } from '../../contexts/TabBarVisibilityContext'
import { useFeedData } from './hooks/useFeedData'
import { useFollowingFeedData } from './hooks/useFollowingFeedData'
import { useVideoPlayerPool } from './hooks/useVideoPlayerPool'
import { usePrefetch } from './hooks/usePrefetch'
import { FeedList } from './components/FeedList'
import { forYouFeedStore, followingFeedStore } from './store/feedStore'
import { auth } from '../../lib/firebase'
import { colors } from '../../lib/theme'
import { captureException } from '../../lib/sentry'
import { VideoCache } from './services/VideoCache'
import CommentSheet from './components/CommentSheet'
import VideoOptionsSheet from './components/VideoOptionsSheet'
import ShareModal from '../share/components/ShareModal'
import { useShareStore } from '../share/store/shareStore'
import type { PreviewComment } from '../../types'

type FeedType = 'forYou' | 'following'

interface FeedScreenProps {
  feedType?: FeedType
  isActive?: boolean
}

export default function FeedScreen({ feedType = 'forYou', isActive = true }: FeedScreenProps) {
  const store = feedType === 'forYou' ? forYouFeedStore : followingFeedStore
  const instanceId = feedType === 'forYou' ? 'feed-foryou' : 'feed-following'
  const [refreshing, setRefreshing] = useState(false)
  const { hideTabBar, showTabBar } = useTabBarVisibility()
  const [commentTarget, setCommentTarget] = useState<{
    videoId: string; videoOwnerId: string; isOwner: boolean; previewComments?: PreviewComment[]
  } | null>(null)
  const [videoOptionsTarget, setVideoOptionsTarget] = useState<{
    videoId: string; isOwner: boolean
  } | null>(null)
  const commentSheetRef = useRef<BottomSheet>(null)
  const videoOptionsSheetRef = useRef<BottomSheet>(null)
  const prevActiveRef = useRef(isActive)
  const isShareModalVisible = useShareStore((s) => s.isModalVisible)

  const skipToNext = useStore(store, (s) => s.skipToNext)
  const setCurrentIndex = useStore(store, (s) => s.setCurrentIndex)
  const setIsScrolling = useStore(store, (s) => s.setIsScrolling)
  const currentIndex = useStore(store, (s) => s.currentIndex)
  const isScrolling = useStore(store, (s) => s.isScrolling)

  const feedData = feedType === 'forYou'
    ? useFeedData({ store })
    : useFollowingFeedData({ store, isActive })

  const pool = useVideoPlayerPool(instanceId, skipToNext)
  usePrefetch(feedData.videos, currentIndex)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await feedData.refresh()
    setRefreshing(false)
  }, [feedData])

  const handlePressComment = useCallback((videoId: string) => {
    const video = feedData.videos.find((v) => v.id === videoId)
    if (!video) return
    const ownerId = video.userId ?? ''
    const isOwner = auth.currentUser?.uid === ownerId
    setCommentTarget({ videoId, videoOwnerId: ownerId, isOwner, previewComments: video.previewComments })
  }, [feedData.videos])

  const handlePressShare = useCallback((videoId: string) => {
    const video = feedData.videos.find((v) => v.id === videoId)
    if (!video) return
    useShareStore.getState().openShareModal({
      id: video.id,
      url: video.videoURL_480p || video.videoURL,
      description: video.description,
      thumbnailURL: video.thumbnailURL,
      userName: video.userName,
    })
  }, [feedData.videos])

  const handleLongPress = useCallback((videoId: string) => {
    const video = feedData.videos.find((v) => v.id === videoId)
    if (!video) return
    const ownerId = video.userId ?? ''
    const isOwner = auth.currentUser?.uid === ownerId
    setVideoOptionsTarget(null)
    setTimeout(() => setVideoOptionsTarget({ videoId, isOwner }), 0)
  }, [feedData.videos])

  const handlePressMore = useCallback((videoId: string) => {
    const video = feedData.videos.find((v) => v.id === videoId)
    if (!video) return
    const ownerId = video.userId ?? ''
    const isOwner = auth.currentUser?.uid === ownerId
    setVideoOptionsTarget(null)
    setTimeout(() => setVideoOptionsTarget({ videoId, isOwner }), 0)
  }, [feedData.videos])

  useEffect(() => {
    if (videoOptionsTarget) {
      const timer = setTimeout(() => videoOptionsSheetRef.current?.snapToIndex(0), 100)
      return () => clearTimeout(timer)
    }
  }, [videoOptionsTarget])

  useFocusEffect(
    useCallback(() => {
      return () => {
        setCommentTarget(null)
        showTabBar()
      }
    }, [showTabBar])
  )

  useEffect(() => {
    if (commentTarget) {
      hideTabBar()
      const timer = setTimeout(() => commentSheetRef.current?.snapToIndex(0), 100)
      return () => clearTimeout(timer)
    } else {
      showTabBar()
    }
  }, [commentTarget, hideTabBar, showTabBar])

  useEffect(() => {
    VideoCache.warm().catch((e) => {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'VideoCache.warm' })
    })
  }, [])

  useEffect(() => {
    if (!isActive) return
    pool.syncPool(feedData.videos, currentIndex, isScrolling)
  }, [isActive, currentIndex, isScrolling, feedData.videos, pool])

  useEffect(() => {
    if (isActive) return
    const s = store.getState()
    const video = s.videos[s.currentIndex]
    if (video) pool.getPlayer(video.id)?.pause()
  }, [])

  useEffect(() => {
    const handleAppState = (state: string) => {
      if (!isActive) return
      if (state === 'background') {
        const s = store.getState()
        const video = s.videos[s.currentIndex]
        if (video) {
          pool.getPlayer(video.id)?.pause()
        }
      } else if (state === 'active') {
        const s = store.getState()
        s.setPendingActivation(true)
        pool.syncPool(s.videos, s.currentIndex, false)
        const video = s.videos[s.currentIndex]
        if (video) pool.getPlayer(video.id)?.play()
      }
    }
    const sub = AppState.addEventListener('change', handleAppState)
    return () => sub.remove()
  }, [isActive, pool, store])

  useEffect(() => {
    if (prevActiveRef.current === isActive) return
    prevActiveRef.current = isActive
    const s = store.getState()
    const video = s.videos[s.currentIndex]
    if (!isActive) {
      if (video) pool.getPlayer(video.id)?.pause()
    } else {
      s.setPendingActivation(true)
      pool.syncPool(s.videos, s.currentIndex, false)
      if (video) pool.getPlayer(video.id)?.play()
    }
  }, [isActive, pool, store])

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <FeedList
        videos={feedData.videos}
        suggestions={[]}
        onDismissSuggestion={() => {}}
        isLoadingMore={feedData.isLoadingMore}
        hasMore={feedData.hasMore}
        instanceId={instanceId}
        feedType={feedType}
        currentIndex={currentIndex}
        setCurrentIndex={setCurrentIndex}
        setIsScrolling={setIsScrolling}
        isActive={isActive}
        onLongPress={handleLongPress}
        onPressComment={handlePressComment}
        onPressShare={handlePressShare}
        onPressMore={handlePressMore}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        scrollEnabled={!commentTarget}
      />

      {commentTarget && (
        <CommentSheet
          key={commentTarget.videoId}
          videoId={commentTarget.videoId}
          videoOwnerId={commentTarget.videoOwnerId}
          isOwner={commentTarget.isOwner}
          previewComments={commentTarget.previewComments}
          onClose={() => setCommentTarget(null)}
          sheetRef={commentSheetRef}
        />
      )}

      {videoOptionsTarget && (
        <VideoOptionsSheet
          key={videoOptionsTarget.videoId}
          videoId={videoOptionsTarget.videoId}
          isOwner={videoOptionsTarget.isOwner}
          onClose={() => setVideoOptionsTarget(null)}
          sheetRef={videoOptionsSheetRef}
        />
      )}

      <ShareModal
        visible={isShareModalVisible}
        onClose={() => useShareStore.getState().closeShareModal()}
      />
    </View>
  )
}
