/* FeedScreen — page orchestrateur du feed vertical TikTok-like.
   Rôle : monte tous les hooks (useFeedData/useFollowingFeedData, useVideoPlayerPool, usePrefetch),
   initialise VideoCache.warm(), rend FeedList.
   Générique : prend feedType pour sélectionner le store et le pool.
   Gère AppState et isActive (pause/reprise du player). */

import { useEffect, useCallback, useRef, useState } from 'react'
import { View, AppState, StyleSheet, Text, TouchableOpacity, Alert, Dimensions, Pressable } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { useStore } from 'zustand'
import BottomSheet from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import { VideoCache } from './services/VideoCache'
import { useFeedData } from './hooks/useFeedData'
import { useFollowingFeedData } from './hooks/useFollowingFeedData'
import { useVideoPlayerPool } from './hooks/useVideoPlayerPool'
import { usePrefetch } from './hooks/usePrefetch'
import { FeedList } from './components/FeedList'
import { forYouFeedStore, followingFeedStore, FEED_DEBUG } from './store/feedStore'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { colors } from '../../lib/theme'
import MboloBottomSheet from '../../components/MboloBottomSheet'
import CommentSheet from './components/CommentSheet'
import * as MediaLibrary from 'expo-media-library'
import { captureException } from '../../lib/sentry'
import type { PreviewComment } from '../../types'
import ShareModal from '../share/components/ShareModal'
import { useShareStore } from '../share/store/shareStore'
import { useShareSuggestions } from '../share/hooks/useShareSuggestions'
import { useFollowSuggestions } from '../suggestions/hooks/useFollowSuggestions'

type FeedType = 'forYou' | 'following'

interface FeedScreenProps {
  feedType?: FeedType
  isActive?: boolean
}

export default function FeedScreen({ feedType = 'forYou', isActive = true }: FeedScreenProps) {
  const store = feedType === 'forYou' ? forYouFeedStore : followingFeedStore
  const instanceId = feedType === 'forYou' ? 'feed-foryou' : 'feed-following'
  const prevActiveRef = useRef(isActive)
  const [refreshing, setRefreshing] = useState(false)

  const skipToNext = useStore(store, (s) => s.skipToNext)
  const setCurrentIndex = useStore(store, (s) => s.setCurrentIndex)
  const setIsScrolling = useStore(store, (s) => s.setIsScrolling)
  const feedData = feedType === 'forYou'
    ? useFeedData({ store })
    : useFollowingFeedData({ store, isActive })

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await feedData.refresh()
    setRefreshing(false)
  }, [feedData])

  const pool = useVideoPlayerPool(instanceId, skipToNext)
  const currentIndex = useStore(store, (s) => s.currentIndex)
  const isScrolling = useStore(store, (s) => s.isScrolling)

  usePrefetch(feedData.videos, currentIndex)

  useEffect(() => {
    VideoCache.warm()
  }, [])

  useEffect(() => {
    pool.syncPool(feedData.videos, currentIndex, isScrolling)
  }, [currentIndex, isScrolling, feedData.videos, pool])

  const handleAppState = useCallback(
    (state: string) => {
      if (!isActive) return
      if (state === 'background') {
        const s = store.getState()
        const video = s.videos[s.currentIndex]
        if (video) {
          const player = pool.getPlayer(video.id)
          if (player) {
            player.pause()
            if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDSCREEN: pause', feedType, 'on background')
          }
        }
      } else if (state === 'active') {
        const s = store.getState()
        s.setPendingActivation(true)
        pool.syncPool(s.videos, s.currentIndex, false)
        const video = s.videos[s.currentIndex]
        if (video) pool.getPlayer(video.id)?.play()
        if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDSCREEN: resume', feedType, 'on active')
      }
    },
    [pool, store, isActive, feedType],
  )

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppState)
    return () => sub.remove()
  }, [handleAppState])

  useEffect(() => {
    if (prevActiveRef.current === isActive) return
    prevActiveRef.current = isActive

    if (!isActive) {
      const s = store.getState()
      const video = s.videos[s.currentIndex]
      if (video) {
        const player = pool.getPlayer(video.id)
        if (player) {
          player.pause()
          if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDSCREEN: pause', feedType, 'on inactive')
        }
      }
    } else {
      const s = store.getState()
      s.setPendingActivation(true)
      pool.syncPool(s.videos, s.currentIndex, false)
      const video = s.videos[s.currentIndex]
      if (video) pool.getPlayer(video.id)?.play()
      if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDSCREEN: resume', feedType, 'on active')
    }
  }, [isActive, pool, store, feedType])

  const SCREEN_HEIGHT = Dimensions.get('window').height
  const sheetHeight = useSharedValue(0)

  const videoAreaStyle = useAnimatedStyle(() => ({
    height: SCREEN_HEIGHT - sheetHeight.value,
    overflow: 'hidden',
  }))

  const [commentTarget, setCommentTarget] = useState<{
    videoId: string; videoOwnerId: string; isOwner: boolean; previewComments?: PreviewComment[]
  } | null>(null)
  const [longPressedVideoId, setLongPressedVideoId] = useState<string | null>(null)
  const [speedVisible, setSpeedVisible] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const optionsSheetRef = useRef<BottomSheet>(null)
  const shareToastMessage = useShareStore((s) => s.toastMessage)
  const shareToastVisible = useShareStore((s) => s.toastVisible)
  const isShareModalVisible = useShareStore((s) => s.isModalVisible)
  const openShareModal = useShareStore((s) => s.openShareModal)
  const closeShareModal = useShareStore((s) => s.closeShareModal)
  const hideToast = useShareStore((s) => s.hideToast)
  const currentVideoId = feedData.videos[currentIndex]?.id
  const { suggestions: shareSuggestions, loading: shareSuggestionsLoading } = useShareSuggestions(currentVideoId)
  const {
    suggestions: followSuggestions,
    dismissSuggestion,
  } = useFollowSuggestions({ maxResults: 20 })

  const handlePressComment = useCallback((videoId: string) => {
    const video = feedData.videos.find((v) => v.id === videoId)
    if (!video) return
    const ownerId = video.userId ?? ''
    const isOwner = auth.currentUser?.uid === ownerId
    setCommentTarget({ videoId, videoOwnerId: ownerId, isOwner, previewComments: video.previewComments })
    if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: sheet opened → video height =', SCREEN_HEIGHT * 0.45)
  }, [feedData.videos])

  const handleCloseComment = useCallback(() => {
    setCommentTarget(null)
    if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: tap on video → sheet closed')
  }, [])

  useEffect(() => {
    const currentVideo = feedData.videos[currentIndex]
    if (!currentVideo) return
    const player = pool.getPlayer(currentVideo.id)
    if (commentTarget) {
      player?.pause()
      if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: video paused on sheet open')
    } else {
      player?.play()
      if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: video resumed on sheet close')
    }
  }, [commentTarget])

  const handleLongPress = useCallback((videoId: string) => {
    setLongPressedVideoId(videoId)
    setSpeedVisible(false)
    optionsSheetRef.current?.snapToIndex(0)
    if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDSCREEN: long press → sheet open', videoId)
  }, [])

  const handleCloseOptions = useCallback(() => {
    setSpeedVisible(false)
    optionsSheetRef.current?.close()
    if (longPressedVideoId) {
      const player = pool.getPlayer(longPressedVideoId)
      player?.play()
    }
    if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDSCREEN: sheet closed')
  }, [longPressedVideoId, pool])

  const handleSpeedSelect = useCallback((speed: number) => {
    if (!longPressedVideoId) return
    const player = pool.getPlayer(longPressedVideoId)
    if (player) player.playbackRate = speed
    setPlaybackRate(speed)
    setSpeedVisible(false)
    if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDSCREEN: speed changed →', speed, longPressedVideoId)
  }, [longPressedVideoId, pool])

  const handleDownload = useCallback(async () => {
    if (!longPressedVideoId) return
    const video = feedData.videos.find((v) => v.id === longPressedVideoId)
    if (!video) return
    const { status } = await MediaLibrary.requestPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Impossible de télécharger la vidéo sans permission.')
      return
    }
    try {
      await MediaLibrary.saveToLibraryAsync(video.videoURL)
      Alert.alert('Téléchargé ✓', 'Vidéo enregistrée dans la galerie.')
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'download', videoId: longPressedVideoId })
      Alert.alert('Erreur', 'Impossible de télécharger la vidéo.')
    }
    handleCloseOptions()
  }, [longPressedVideoId, feedData.videos, handleCloseOptions])

  const handleNotInterested = useCallback(() => {
    handleCloseOptions()
    const s = store.getState()
    s.skipToNext?.()
    if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDSCREEN: not interested →', longPressedVideoId)
  }, [handleCloseOptions, longPressedVideoId, store])

  const handleReport = useCallback(() => {
    handleCloseOptions()
    Alert.alert('Signaler', 'Que souhaitez-vous signaler ?', [
      { text: 'Contenu inapproprié', onPress: () => Alert.alert('Merci', 'Votre signalement a été envoyé.') },
      { text: 'Harcèlement', onPress: () => Alert.alert('Merci', 'Votre signalement a été envoyé.') },
      { text: 'Autre', onPress: () => Alert.alert('Merci', 'Votre signalement a été envoyé.') },
      { text: 'Annuler', style: 'cancel' },
    ])
  }, [handleCloseOptions])

  const handleCaption = useCallback(() => {
    handleCloseOptions()
    Alert.alert('Info', 'Fonctionnalité bientôt disponible')
  }, [handleCloseOptions])

  const handlePressShare = useCallback((videoId: string) => {
    const video = feedData.videos.find((v) => v.id === videoId)
    if (!video) return
    openShareModal({
      id: video.id,
      url: video.videoURL_480p || video.videoURL,
      description: video.description,
      thumbnailURL: video.thumbnailURL,
      userName: video.userName ?? userNames[video.userId],
    })
  }, [feedData.videos, userNames, openShareModal])

  useEffect(() => {
    if (!shareToastVisible || !shareToastMessage) return
    const t = setTimeout(() => hideToast(), 2000)
    return () => clearTimeout(t)
  }, [shareToastVisible, shareToastMessage, hideToast])

  const SPEEDS = [
    { label: '0.5×', value: 0.5 },
    { label: '0.75×', value: 0.75 },
    { label: 'Normal', value: 1 },
    { label: '1.5×', value: 1.5 },
    { label: '2×', value: 2 },
  ]

  const fetchedUserIds = useRef(new Set<string>())
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const [userPhotos, setUserPhotos] = useState<Record<string, string>>({})

  useEffect(() => {
    const currentUid = auth.currentUser?.uid
    const missingIds = new Set<string>()
    for (const v of feedData.videos) {
      if ((!v.userName || !v.userPhotoURL) && v.userId && v.userId !== currentUid && !fetchedUserIds.current.has(v.userId)) {
        missingIds.add(v.userId)
      }
    }
    if (missingIds.size === 0) return
    for (const id of missingIds) fetchedUserIds.current.add(id)
    const ids = Array.from(missingIds)
    let cancelled = false
    ;(async () => {
      const nomMap: Record<string, string> = {}
      const photoMap: Record<string, string> = {}
      for (let i = 0; i < ids.length; i += 30) {
        const batch = ids.slice(i, i + 30)
        const results = await Promise.allSettled(
          batch.map((id) => getDoc(doc(db, 'users', id)))
        )
        for (let j = 0; j < results.length; j++) {
          const r = results[j]
          if (r.status === 'fulfilled' && r.value.exists()) {
            const data = r.value.data()
            nomMap[batch[j]] = typeof data?.nom === 'string' ? data.nom : batch[j]
            photoMap[batch[j]] = typeof data?.photoURL === 'string' ? data.photoURL : ''
          } else {
            nomMap[batch[j]] = batch[j]
            photoMap[batch[j]] = ''
          }
        }
      }
      if (!cancelled) {
        setUserNames((prev) => ({ ...prev, ...nomMap }))
        setUserPhotos((prev) => ({ ...prev, ...photoMap }))
      }
    })()
    return () => { cancelled = true }
  }, [feedData.videos])

  if (feedData.isEmpty) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Aucune vidéo pour l'instant</Text>
        <Text style={styles.emptySubtitle}>
          Suis des comptes pour voir leurs vidéos ici
        </Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0 }, videoAreaStyle]}>
        {commentTarget && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleCloseComment}
          />
        )}
        <FeedList
          videos={feedData.videos}
          suggestions={followSuggestions}
          onDismissSuggestion={dismissSuggestion}
          isLoadingMore={feedData.isLoadingMore}
          hasMore={feedData.hasMore}
          instanceId={instanceId}
          feedType={feedType}
          currentIndex={currentIndex}
          setCurrentIndex={setCurrentIndex}
          setIsScrolling={setIsScrolling}
          isActive={isActive}
          userNames={userNames}
          userPhotos={userPhotos}
          onLongPress={handleLongPress}
          onPressComment={handlePressComment}
          onPressShare={handlePressShare}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          scrollEnabled={!commentTarget}
        />
      </Animated.View>

      {commentTarget && (
        <CommentSheet
          key={commentTarget.videoId}
          videoId={commentTarget.videoId}
          videoOwnerId={commentTarget.videoOwnerId}
          isOwner={commentTarget.isOwner}
          previewComments={commentTarget.previewComments}
          onClose={() => {
            setCommentTarget(null)
            if (FEED_DEBUG) console.log('[FEED_DEBUG] COMMENTS: sheet closed → video height restored')
          }}
          sheetHeight={sheetHeight}
        />
      )}

      <MboloBottomSheet
        sheetRef={optionsSheetRef}
        snapPoints={['60%']}
        title="Options"
        onClose={handleCloseOptions}
        showCloseButton
      >
        {speedVisible ? (
          <View style={feedStyles.speedContainer}>
            <Text style={feedStyles.speedTitle}>Vitesse de lecture</Text>
            <View style={feedStyles.speedRow}>
              {SPEEDS.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[feedStyles.speedPill, playbackRate === s.value && feedStyles.speedPillActive]}
                  onPress={() => handleSpeedSelect(s.value)}
                >
                  <Text style={[feedStyles.speedPillText, playbackRate === s.value && feedStyles.speedPillTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View>
            <OptionItem icon="download-outline" label="Télécharger" onPress={handleDownload} />
            <OptionItem icon="thumbs-down-outline" label="Pas intéressé(e)" onPress={handleNotInterested} />
            <OptionItem icon="flag-outline" label="Signaler" onPress={handleReport} />
            <OptionItem icon="speedometer-outline" label="Vitesse" onPress={() => setSpeedVisible(true)} />
            <OptionItem icon="text-outline" label="Légende" onPress={handleCaption} />
          </View>
        )}
      </MboloBottomSheet>
      <ShareModal
        visible={isShareModalVisible}
        onClose={closeShareModal}
        preloadedSuggestions={shareSuggestions}
        suggestionsLoading={shareSuggestionsLoading}
      />

      {shareToastVisible && shareToastMessage && (
        <View style={{
          position: 'absolute',
          bottom: 120,
          left: 20,
          right: 20,
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <View style={{
            backgroundColor: '#00C853',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
          }}>
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{shareToastMessage}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

interface OptionItemProps {
  icon: string
  label: string
  onPress: () => void
}

function OptionItem({ icon, label, onPress }: OptionItemProps) {
  return (
    <TouchableOpacity style={feedStyles.optionRow} onPress={onPress}>
      <Ionicons name={icon as any} size={24} color="#FFFFFF" />
      <Text style={feedStyles.optionRowLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const feedStyles = StyleSheet.create({
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionRowLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
  },
  speedContainer: {
    paddingBottom: 20,
  },
  speedTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  speedRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  speedPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  speedPillActive: {
    backgroundColor: '#00C853',
  },
  speedPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  speedPillTextActive: {
    fontWeight: '700',
  },
})

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
})
