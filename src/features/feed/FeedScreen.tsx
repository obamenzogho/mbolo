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
import { useLocalFeedData } from './hooks/useLocalFeedData'
import { useVideoPlayerPool } from './hooks/useVideoPlayerPool'
import { usePrefetch } from './hooks/usePrefetch'
import { FeedList } from './components/FeedList'
import { forYouFeedStore, followingFeedStore, localFeedStore } from './store/feedStore'
import { auth } from '../../lib/firebase'
import { colors } from '../../lib/theme'
import { captureException } from '../../lib/sentry'
import { VideoCache } from './services/VideoCache'
import { loadWatchCache } from './services/watchTracker'
import { recordView } from './services/viewService'
import CommentSheet from './components/CommentSheet'
import VideoOptionsSheet from './components/VideoOptionsSheet'
import ShareModal from '../share/components/ShareModal'
import { useShareStore } from '../share/store/shareStore'
import type { PreviewComment } from '../../types'
import type { Place } from '../location/useUserLocation'

type FeedType = 'forYou' | 'following' | 'local'

interface FeedScreenProps {
  feedType?: FeedType
  isActive?: boolean
  place?: Place | null
}

export default function FeedScreen({ feedType = 'forYou', isActive = true, place = null }: FeedScreenProps) {
  const store = feedType === 'forYou' ? forYouFeedStore
    : feedType === 'following' ? followingFeedStore
    : localFeedStore
  const instanceId = feedType === 'forYou' ? 'feed-foryou'
    : feedType === 'following' ? 'feed-following'
    : 'feed-local'
  const [refreshing, setRefreshing] = useState(false)
  const { hideTabBar, showTabBar } = useTabBarVisibility()
  const [commentTarget, setCommentTarget] = useState<{
    videoId: string; videoOwnerId: string; isOwner: boolean; previewComments?: PreviewComment[]
  } | null>(null)
  const [videoOptionsTarget, setVideoOptionsTarget] = useState<{
    videoId: string; isOwner: boolean; contentOwnerId?: string; contentOwnerName?: string
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
    : feedType === 'following'
      ? useFollowingFeedData({ store, isActive })
      : useLocalFeedData({ store, place })

  const pool = useVideoPlayerPool(instanceId, skipToNext)
  usePrefetch(feedData.videos, currentIndex, isActive)

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
    const isOwner = auth.currentUser?.uid === (video.userId ?? '')
    setVideoOptionsTarget({ videoId, isOwner })
  }, [feedData.videos])

  const handlePressMore = useCallback((videoId: string) => {
    const video = feedData.videos.find((v) => v.id === videoId)
    if (!video) return
    const isOwner = auth.currentUser?.uid === (video.userId ?? '')
    setVideoOptionsTarget({ videoId, isOwner, contentOwnerId: video.userId, contentOwnerName: video.userName })
  }, [feedData.videos])

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

  // Même pattern que les commentaires : la sheet monte fermée (index={-1}) puis
  // on l'ouvre explicitement. Un BottomSheet monté directement à index={0}
  // n'anime pas son ouverture de façon fiable → le menu ne s'affichait pas.
  useEffect(() => {
    if (!videoOptionsTarget) return
    const timer = setTimeout(() => videoOptionsSheetRef.current?.snapToIndex(0), 50)
    return () => clearTimeout(timer)
  }, [videoOptionsTarget])

  useEffect(() => {
    VideoCache.warm().catch((e) => {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'VideoCache.warm' })
    })
    loadWatchCache()
  }, [])

  useEffect(() => {
    pool.setActive(isActive)
  }, [isActive, pool])

  useEffect(() => {
    if (!isActive) return
    pool.syncPool(feedData.videos, currentIndex, isScrolling)
  }, [isActive, currentIndex, isScrolling, feedData.videos, pool])

  useEffect(() => {
    if (!isActive) return
    const video = feedData.videos[currentIndex]
    if (!video) return
    const t = setTimeout(() => recordView(video.id), 1000)
    return () => clearTimeout(t)
  }, [isActive, currentIndex, feedData.videos])

  useEffect(() => {
    if (isActive) return
    pool.setActive(false)
    pool.pauseAll()
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
    if (!isActive) {
      pool.pauseAll()
    } else {
      s.setPendingActivation(true)
      pool.syncPool(s.videos, s.currentIndex, false)
      // Pas de play() direct : syncPool joue le CURRENT si isActive && !isScrolling
    }
  }, [isActive, pool, store])

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.black }}
    >
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
        commentsOpen={!!commentTarget}
      />

      {commentTarget && (
        <CommentSheet
          key={`comment-${commentTarget.videoId}`}
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
          key={`options-${videoOptionsTarget.videoId}`}
          videoId={videoOptionsTarget.videoId}
          isOwner={videoOptionsTarget.isOwner}
          contentOwnerId={videoOptionsTarget.contentOwnerId}
          contentOwnerName={videoOptionsTarget.contentOwnerName}
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
