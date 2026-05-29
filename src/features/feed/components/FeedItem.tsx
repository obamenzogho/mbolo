import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { View, Text, Animated, TouchableOpacity, Dimensions, StyleSheet, Image, Alert } from 'react-native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { auth } from '../../../lib/firebase'
import { updateDoc, doc, increment, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { createNotification } from '../../../lib/notifications'
import { captureException } from '../../../lib/sentry'

import { VideoPlayerSlot, usePlayerForVideo } from './VideoPlayerSlot'
import { useFeedStore, FEED_DEBUG } from '../store/feedStore'
import { RepostButton } from '@/features/repost/components/RepostButton'
import { RepostedByBanner } from '@/features/repost/components/RepostedByBanner'
import { useFollow } from '@/hooks/useFollow'
import { ShareButton } from '@/features/share/components/ShareButton'
import type { Video } from '../../../types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { runOnJS } from 'react-native-reanimated'
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')

interface FeedItemProps {
  item: Video
  index: number
  instanceId?: string
  onPressComment?: (videoId: string) => void
  onPressShare?: (videoId: string) => void
  onLongPress?: () => void
  username?: string
  userPhotoURL?: string
  isActive?: boolean
  currentIndex?: number
}

function FeedItemComponent({ item, index, instanceId = 'feed', onPressComment, onPressShare, onLongPress, username, userPhotoURL, isActive: isActiveProp, currentIndex: currentIndexProp }: FeedItemProps) {
  const storeCurrentIndex = useFeedStore((s) => s.currentIndex)
  const currentIndex = currentIndexProp ?? storeCurrentIndex
  const isActive = isActiveProp !== undefined ? isActiveProp : (index === currentIndex)
  const currentUserId = auth.currentUser?.uid ?? ''
  const displayName = item.userName ?? username ?? 'Utilisateur'
  const avatarURL = item.userPhotoURL || userPhotoURL
  const isOwn = item.userId === currentUserId
  const insets = useSafeAreaInsets()
  const player = usePlayerForVideo(instanceId, item.id)
  const [liked, setLiked] = useState(item.likedBy?.includes(currentUserId) ?? false)
  const [saved, setSaved] = useState(item.savedBy?.includes(currentUserId) ?? false)
  const [likeCount, setLikeCount] = useState(item.likes)
  const [saveCount, setSaveCount] = useState(item.saves)
  const [showFullDesc, setShowFullDesc] = useState(false)
  const [gestureIcon, setGestureIcon] = useState<'play' | 'pause'>('play')
  const [isPlaying, setIsPlaying] = useState(true)
  const barHeight = useRef(new Animated.Value(1)).current
  const likeHeartOpacity = useRef(new Animated.Value(0)).current
  const likeHeartScale = useRef(new Animated.Value(0.5)).current
  const likeIconScale = useRef(new Animated.Value(1)).current
  const [repostToast, setRepostToast] = useState<string | null>(null)
  const repostToastTimer = useRef<ReturnType<typeof setTimeout>>()
  const [followState, setFollowState] = useState<'idle' | 'done' | 'hidden'>('idle')
  const followTimer = useRef<ReturnType<typeof setTimeout>>()
  const { isFollowing, toggleFollow } = useFollow(item.userId)
  const isDirty = useRef(false)
  const isPausedRef = useRef(false)
  const gesturePlayOpacity = useRef(new Animated.Value(0)).current
  const gestureSeekLeftOpacity = useRef(new Animated.Value(0)).current
  const gestureSeekRightOpacity = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  const isSeekingRef = useRef(false)
  const [seekInfo, setSeekInfo] = useState<{ label: string; x: number } | null>(null)
  const discRotation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const uid = auth.currentUser?.uid ?? ''
    setLiked(item.likedBy?.includes(uid) ?? false)
    setSaved(item.savedBy?.includes(uid) ?? false)
    setLikeCount(item.likes)
    setSaveCount(item.saves)
  }, [item.id, item.likes, item.saves, item.likedBy, item.savedBy])

  useEffect(() => {
    if (!isActive || !player) return
    const interval = setInterval(() => {
      if (isSeekingRef.current) return
      const dur = player.duration
      if (dur && dur > 0) {
        progressAnim.setValue(player.currentTime / dur)
      }
      setIsPlaying(player.playing ?? true)
    }, 100)
    return () => {
      clearInterval(interval)
      progressAnim.setValue(0)
    }
  }, [isActive, player, progressAnim])

  useEffect(() => {
    Animated.spring(barHeight, {
      toValue: isPlaying ? 1 : 4,
      useNativeDriver: false,
      friction: 8,
    }).start()
  }, [isPlaying, barHeight])

  useEffect(() => {
    discRotation.setValue(0)
    if (!isPlaying) return
    const anim = Animated.loop(
      Animated.timing(discRotation, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: true,
      })
    )
    anim.start()
    return () => anim.stop()
  }, [isPlaying, discRotation])

  useEffect(() => {
    return () => clearTimeout(followTimer.current)
  }, [])

  const handleLike = useCallback(async () => {
    isDirty.current = true
    const user = auth.currentUser
    if (!user) return
    const ref = doc(db, 'videos', item.id)
    if (liked) {
      setLiked(false)
      setLikeCount((p) => Math.max(0, p - 1))
      try { await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(user.uid) }) }
      catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'unlike' }); setLiked(true); setLikeCount((p) => p + 1) }
    } else {
      setLiked(true)
      setLikeCount((p) => p + 1)
      try {
        await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(user.uid) })
        createNotification({ userId: item.userId, type: 'like', fromUserId: user.uid, videoId: item.id })
      } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'like' }); setLiked(false); setLikeCount((p) => Math.max(0, p - 1)) }
    }
  }, [liked, item.id, item.userId])

  const handleDoubleTapLike = useCallback(async () => {
    const user = auth.currentUser
    if (!user || liked) return
    setLiked(true)
    setLikeCount((p) => p + 1)
    try {
      await updateDoc(doc(db, 'videos', item.id), { likes: increment(1), likedBy: arrayUnion(user.uid) })
      createNotification({ userId: item.userId, type: 'like', fromUserId: user.uid, videoId: item.id })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'doubleTapLike' }); setLiked(false); setLikeCount((p) => Math.max(0, p - 1)) }
  }, [liked, item.id, item.userId])

  const showLikeHeart = useCallback(() => {
    likeHeartOpacity.setValue(1)
    likeHeartScale.setValue(0.5)
    Animated.parallel([
      Animated.sequence([
        Animated.timing(likeHeartOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(likeHeartOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.spring(likeHeartScale, { toValue: 1.2, useNativeDriver: true, friction: 4 }),
    ]).start()
  }, [likeHeartOpacity, likeHeartScale])

  const animateLikeIcon = useCallback(() => {
    likeIconScale.setValue(1)
    Animated.spring(likeIconScale, { toValue: 1.4, useNativeDriver: true, friction: 3 }).start(() => {
      Animated.spring(likeIconScale, { toValue: 1, useNativeDriver: true, friction: 3 }).start()
    })
  }, [likeIconScale])

  const handleSave = useCallback(async () => {
    isDirty.current = true
    const user = auth.currentUser
    if (!user) return
    const ref = doc(db, 'videos', item.id)
    if (saved) {
      setSaved(false)
      setSaveCount((p) => Math.max(0, p - 1))
      try { await updateDoc(ref, { saves: increment(-1), savedBy: arrayRemove(user.uid) }) }
      catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'unsave' }); setSaved(true); setSaveCount((p) => p + 1) }
    } else {
      setSaved(true)
      setSaveCount((p) => p + 1)
      try { await updateDoc(ref, { saves: increment(1), savedBy: arrayUnion(user.uid) }) }
      catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'save' }); setSaved(false); setSaveCount((p) => Math.max(0, p - 1)) }
    }
  }, [saved, item.id])

  const handleShare = useCallback(() => {
    onPressShare?.(item.id)
  }, [item.id, onPressShare])

  const handleMore = useCallback(() => {
    const options: { text: string; onPress: () => void; style?: 'cancel' }[] = [
      { text: 'Ne plus voir ce contenu', onPress: () => {} },
      { text: 'Signaler', onPress: () => {} },
    ]
    if (isOwn) {
      options.push({ text: 'Supprimer la vidéo', onPress: () => {} })
      options.push({ text: 'Modifier la description', onPress: () => {} })
    }
    options.push({ text: 'Annuler', onPress: () => {}, style: 'cancel' })
    Alert.alert('Options', undefined, options)
  }, [isOwn])

  const handleFollow = useCallback(() => {
    if (followState !== 'idle') return
    toggleFollow()
    setFollowState('done')
    clearTimeout(followTimer.current)
    followTimer.current = setTimeout(() => setFollowState('hidden'), 2000)
  }, [followState, toggleFollow])

  const showGestureIcon = useCallback((type: 'play' | 'seekLeft' | 'seekRight') => {
    const opac = type === 'seekLeft' ? gestureSeekLeftOpacity : type === 'seekRight' ? gestureSeekRightOpacity : gesturePlayOpacity
    opac.setValue(1)
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(opac, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start()
  }, [gesturePlayOpacity, gestureSeekLeftOpacity, gestureSeekRightOpacity])

  const handleTogglePlay = useCallback(() => {
    if (!player) return
    if (isPausedRef.current) {
      player.play()
      isPausedRef.current = false
      setGestureIcon('pause')
    } else {
      player.pause()
      isPausedRef.current = true
      setGestureIcon('play')
    }
    showGestureIcon('play')
    if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDITEM: tap →', isPausedRef.current ? 'pause' : 'play', item.id)
  }, [player, showGestureIcon, item.id])

  const handleLongPressAction = useCallback(() => {
    if (!player) return
    player.pause()
    isPausedRef.current = true
    onLongPress?.()
    if (FEED_DEBUG) console.log('[FEED_DEBUG] FEEDITEM: long press → sheet open', item.id)
  }, [player, item.id, onLongPress])

  const handleSeekBegin = useCallback(() => {
    isSeekingRef.current = true
    if (!player) return
    if (player.playing) {
      player.pause()
      isPausedRef.current = true
    }
  }, [player])

  const handleSeekUpdate = useCallback((ratio: number) => {
    if (!player) return
    const dur = player.duration
    if (!dur || dur <= 0) return
    const newTime = ratio * dur
    player.currentTime = newTime
    progressAnim.setValue(ratio)
    const totalSecs = Math.round(newTime)
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    setSeekInfo({ label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, x: ratio * SCREEN_WIDTH })
  }, [player, progressAnim])

  const handleSeekEnd = useCallback(() => {
    isSeekingRef.current = false
    setSeekInfo(null)
  }, [])

  const seekPanGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(handleSeekBegin)()
    })
    .onUpdate((e) => {
      const ratio = Math.max(0, Math.min(1, e.x / SCREEN_WIDTH))
      runOnJS(handleSeekUpdate)(ratio)
    })
    .onEnd(() => {
      runOnJS(handleSeekEnd)()
    })

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .numberOfTaps(1)
    .onStart((e) => {
      const isOnRightButtons = e.x > SCREEN_WIDTH - 80
      const isOnBottomArea = e.y > SCREEN_HEIGHT - 250
      if (!isOnRightButtons && !isOnBottomArea) {
        runOnJS(handleTogglePlay)()
      }
    })

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onStart((e) => {
      const x = e.x
      if (x >= SCREEN_WIDTH * 0.3 && x <= SCREEN_WIDTH * 0.7) {
        runOnJS(handleDoubleTapLike)()
        runOnJS(showLikeHeart)()
        runOnJS(animateLikeIcon)()
      }
    })

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      runOnJS(handleLongPressAction)()
    })

  const tapGestures = Gesture.Exclusive(doubleTapGesture, tapGesture)
  const composedGestures = Gesture.Simultaneous(longPressGesture, tapGestures)

  const SPEEDS = [
    { label: '0.5×', value: 0.5 },
    { label: '0.75×', value: 0.75 },
    { label: 'Normal', value: 1 },
    { label: '1.5×', value: 1.5 },
    { label: '2×', value: 2 },
  ]

  const formatCount = (count: number) => count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count

  return (
    <>
    <GestureDetector gesture={composedGestures}>
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}>
      <View style={StyleSheet.absoluteFill}>
        <VideoPlayerSlot videoId={item.id} thumbnailURL={item.thumbnailURL} instanceId={instanceId} />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', opacity: likeHeartOpacity }]}
      >
        <Animated.View style={{ transform: [{ scale: likeHeartScale }] }}>
          <Ionicons name="heart" size={80} color="#FFD700" />
        </Animated.View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', opacity: gesturePlayOpacity }]}
      >
        <Ionicons name={gestureIcon} size={64} color="rgba(255,255,255,0.9)" />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 60, opacity: gestureSeekLeftOpacity }]}
      >
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="play-back" size={48} color="rgba(255,255,255,0.9)" />
          <Text style={{ color: '#FFF', fontSize: 14, marginTop: 4 }}>−5s</Text>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'flex-end', paddingRight: 60, opacity: gestureSeekRightOpacity }]}
      >
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="play-forward" size={48} color="rgba(255,255,255,0.9)" />
          <Text style={{ color: '#FFF', fontSize: 14, marginTop: 4 }}>+5s</Text>
        </View>
      </Animated.View>

      {item.latestRepostedBy && (
        <RepostedByBanner
          repostedBy={item.repostedBy ?? []}
          currentUserId={currentUserId}
          reposterName={item.latestRepostedBy.userName}
          reposterId={item.latestRepostedBy.userId}
        />
      )}

      <LinearGradient
        pointerEvents="box-none"
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        locations={[0.4, 1]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 500 }}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ paddingHorizontal: 12, paddingBottom: 87 + insets.bottom, paddingRight: 66 }}>
            <View style={styles.userRow}>
              <View style={styles.avatarWrapper}>
                {!isOwn && !isFollowing && followState !== 'hidden' && (
                  <TouchableOpacity
                    onPress={handleFollow}
                    style={[
                      styles.followBtn,
                      followState === 'done' && {
                        backgroundColor: '#00C853',
                        borderColor: '#00C853',
                      },
                    ]}
                  >
                    <Ionicons name={followState === 'done' ? 'checkmark' : 'add'} size={followState === 'done' ? 16 : 18} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.userId } })}>
                  {avatarURL ? (
                    <Image source={{ uri: avatarURL }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.userNameBlock}>
                {repostToast && (
                  <View style={{ alignSelf: 'flex-start', backgroundColor: '#00C853', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 4 }}>
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>{repostToast}</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.userId } })}>
                  <Text style={styles.username}><Text style={{ color: '#FFD700', fontSize: 20, fontWeight: '800' }}> | </Text>{displayName}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {item.description ? (
              <TouchableOpacity onPress={() => setShowFullDesc((p) => !p)}>
                <Text style={styles.description} numberOfLines={showFullDesc ? undefined : 3}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            ) : null}

            {item.hashtags?.length > 0 ? (
              <Text style={styles.hashtags}>
                {item.hashtags.map((t) => '#' + t).join(' ')}
              </Text>
            ) : null}

            {item.previewComments && item.previewComments.length > 0 && (
              <View style={{ marginBottom: 6 }}>
                {item.previewComments.slice(0, 2).map((pc, i) => (
                  <Text key={i} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                    <Text style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '600' }}>{pc.authorName}</Text>
                    {' '}{pc.text}
                  </Text>
                ))}
                {item.comments > (item.previewComments?.length ?? 0) && (
                  <TouchableOpacity onPress={onPressComment ? () => onPressComment(item.id) : undefined}>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '500', marginTop: 2 }}>
                      Voir les {item.comments} commentaire{item.comments > 1 ? 's' : ''}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {avatarURL ? (
                <View style={{ width: 24, height: 24 }}>
                  <Animated.Image
                    source={{ uri: avatarURL }}
                    style={{ width: '100%', height: '100%', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', transform: [{ rotate: discRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
                  />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.3)', 'transparent', 'transparent']}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12 }}
                    pointerEvents="none"
                  />
                  <View style={{ position: 'absolute', top: 8, left: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }} />
                </View>
              ) : (
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="musical-notes" size={12} color="#FFF" />
                </View>
              )}
              <Text style={styles.sound}>Son original · {displayName}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.actionsColumn, { bottom: 80 + insets.bottom }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { handleLike(); animateLikeIcon() }}>
            <Animated.View style={{ transform: [{ scale: likeIconScale }] }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={32} color={liked ? '#FFD700' : '#FFF'} />
            </Animated.View>
            <Text style={styles.actionLabel}>{formatCount(likeCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={onPressComment ? () => onPressComment(item.id) : undefined}>
            <Ionicons name="chatbubble-outline" size={28} color="#FFF" />
            <Text style={styles.actionLabel}>{formatCount(item.comments)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleSave}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={28} color={saved ? '#FFD700' : '#FFF'} />
            <Text style={styles.actionLabel}>{formatCount(saveCount)}</Text>
          </TouchableOpacity>

          <RepostButton
            video={item}
            size={28}
            showLabel
            onRepost={(reposted) => {
              const msg = reposted ? 'Vidéo republiée' : 'Republication retirée'
              setRepostToast(msg)
              clearTimeout(repostToastTimer.current)
              repostToastTimer.current = setTimeout(() => setRepostToast(null), 2000)
            }}
          />

          <ShareButton onPress={handleShare} size={28} count={item.shares} />

          <TouchableOpacity style={styles.actionBtn} onPress={handleMore}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
    </GestureDetector>

    {player && (
      <GestureDetector gesture={seekPanGesture}>
        <View style={{ position: 'absolute', bottom: 65 + insets.bottom, left: 0, right: 0, height: 40, justifyContent: 'flex-end' }}>
          <Animated.View style={{ height: barHeight, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1.5 }}>
            <Animated.View style={{ height: '100%', backgroundColor: '#00C853', width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
          </Animated.View>

          {!isPlaying && (
            <Animated.View style={{ position: 'absolute', bottom: -4, left: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [0, SCREEN_WIDTH] }), width: 12, height: 12, borderRadius: 6, backgroundColor: '#00C853', transform: [{ translateX: -6 }] }} />
          )}

          {seekInfo && (
            <View style={{ position: 'absolute', bottom: 46, left: seekInfo.x, transform: [{ translateX: -30 }], alignItems: 'center' }}>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 }}>
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>{seekInfo.label}</Text>
              </View>
            </View>
          )}
        </View>
      </GestureDetector>
    )}
    </>
  )
}

export const FeedItem = memo(FeedItemComponent, (prev, next) => {
  if (prev.item.id !== next.item.id) return false
  if (prev.item.likes !== next.item.likes) return false
  if (prev.item.reposts !== next.item.reposts) return false
  if (prev.item.shares !== next.item.shares) return false
  if (prev.item.saves !== next.item.saves) return false
  if (prev.item.comments !== next.item.comments) return false
  if (prev.item.likedBy !== next.item.likedBy) return false
  if (prev.item.repostedBy !== next.item.repostedBy) return false
  if (prev.item.latestRepostedBy?.userId !== next.item.latestRepostedBy?.userId) return false
  if (prev.username !== next.username) return false
  if (prev.isActive !== next.isActive) return false
  return true
})

const styles = StyleSheet.create({
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarWrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  followBtn: {
    position: 'absolute',
    top: -32,
    alignSelf: 'center',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    zIndex: 1,
  },
  userNameBlock: {
    flex: 1,
    height: 44,
    justifyContent: 'flex-end',
    marginLeft: 10,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  hashtags: {
    color: '#00C853',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sound: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionsColumn: {
    position: 'absolute',
    right: 10,
    alignItems: 'center',
    gap: 16,
  },
})
