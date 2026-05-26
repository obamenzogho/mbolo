import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, Animated, Image, TouchableOpacity, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { auth } from '../../../lib/firebase'
import { updateDoc, doc, increment, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { createNotification } from '../../../lib/notifications'
import { captureException } from '../../../lib/sentry'
import { markSeenAndIncrementView } from '../services/feedService'
import { VideoPlayer } from '../player/VideoPlayer'
import FollowButton from '../../../components/FollowButton'
import { Avatar } from '../../../components/ui/Avatar'
import { colors } from '../../../lib/theme'
import type { Video as VideoType } from '../../../types'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')

interface VideoItemProps {
  item: VideoType
  isActive: boolean
  isTabFocused: boolean
  isPageActive: boolean
  onPressComments: () => void
  onOpenShare: (data: any) => void
  savedPosition: number
  onPositionUpdate: (pos: number) => void
  onReady?: () => void
  username: string
  photoURL: string
  hasUnseenStory?: boolean
  initialFollowing?: boolean
  initialRequested?: boolean
  initialCounts: {
    likes: number
    saves: number
    shares: number
    comments: number
    liked: boolean
    saved: boolean
  }
  bottomPadding?: number
  actionOffset?: number
}

function VideoItemComponent({
  item, isActive, isTabFocused, isPageActive, onPressComments, onOpenShare,
  savedPosition, onPositionUpdate, onReady, username, photoURL, hasUnseenStory, initialFollowing, initialRequested, initialCounts,
  bottomPadding = 50, actionOffset = -23,
}: VideoItemProps) {
  const [paused, setPaused] = useState(false)
  const playOpacity = useRef(new Animated.Value(0)).current
  const likeHeartOpacity = useRef(new Animated.Value(0)).current
  const spinValue = useRef(new Animated.Value(0)).current
  const viewTrackedRef = useRef(false)
  const tapState = useRef({ lastTap: 0, timer: null as ReturnType<typeof setTimeout> | null })
  const isDirty = useRef(false)
  const prevVideoId = useRef(item.id)

  const [liked, setLiked] = useState(initialCounts.liked)
  const [saved, setSaved] = useState(initialCounts.saved)
  const [likeCount, setLikeCount] = useState(initialCounts.likes)
  const [saveCount, setSaveCount] = useState(initialCounts.saves)
  const [commentCount, setCommentCount] = useState(initialCounts.comments)
  const [shareCount, setShareCount] = useState(initialCounts.shares)

  useEffect(() => {
    if (item.id !== prevVideoId.current) {
      prevVideoId.current = item.id
      isDirty.current = false
      setLiked(initialCounts.liked)
      setSaved(initialCounts.saved)
      setLikeCount(initialCounts.likes)
      setSaveCount(initialCounts.saves)
      setCommentCount(initialCounts.comments)
      setShareCount(initialCounts.shares)
    } else if (!isDirty.current) {
      setLiked(initialCounts.liked)
      setSaved(initialCounts.saved)
      setLikeCount(initialCounts.likes)
      setSaveCount(initialCounts.saves)
      setCommentCount(initialCounts.comments)
      setShareCount(initialCounts.shares)
    }
  }, [
    item.id,
    initialCounts.liked,
    initialCounts.saved,
    initialCounts.likes,
    initialCounts.saves,
    initialCounts.comments,
    initialCounts.shares,
  ])

  useEffect(() => {
    if (isActive && isTabFocused && !paused) {
      const anim = Animated.loop(Animated.timing(spinValue, { toValue: 1, duration: 3000, useNativeDriver: true }))
      anim.start()
      return () => anim.stop()
    }
  }, [isActive, isTabFocused, paused, spinValue])

  useEffect(() => {
    if (paused && isActive) {
      Animated.timing(playOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    } else {
      playOpacity.setValue(0)
    }
  }, [paused, isActive, playOpacity])

  useEffect(() => {
    viewTrackedRef.current = false
  }, [item.id])

  const spinInterpolation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const handleLike = useCallback(async () => {
    isDirty.current = true
    const user = auth.currentUser
    if (!user) return
    const ref = doc(db, 'videos', item.id)
    if (liked) {
      setLiked(false)
      setLikeCount(p => Math.max(0, p - 1))
      try { await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(user.uid) }) }
      catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'unlike' }); setLiked(true); setLikeCount(p => p + 1) }
    } else {
      setLiked(true)
      setLikeCount(p => p + 1)
      try {
        await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(user.uid) })
        createNotification({ userId: item.userId, type: 'like', fromUserId: user.uid, videoId: item.id })
      } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'like' }); setLiked(false); setLikeCount(p => Math.max(0, p - 1)) }
    }
  }, [liked, item.id, item.userId])

  const handleSave = useCallback(async () => {
    isDirty.current = true
    const user = auth.currentUser
    if (!user) return
    const ref = doc(db, 'videos', item.id)
    if (saved) {
      setSaved(false)
      setSaveCount(p => Math.max(0, p - 1))
      try { await updateDoc(ref, { saves: increment(-1), savedBy: arrayRemove(user.uid) }) }
      catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'unsave' }); setSaved(true); setSaveCount(p => p + 1) }
    } else {
      setSaved(true)
      setSaveCount(p => p + 1)
      try { await updateDoc(ref, { saves: increment(1), savedBy: arrayUnion(user.uid) }) }
      catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'save' }); setSaved(false); setSaveCount(p => Math.max(0, p - 1)) }
    }
  }, [saved, item.id])

  const togglePause = useCallback(() => setPaused(prev => !prev), [])

  const handleDoubleTapLike = useCallback(async () => {
    isDirty.current = true
    const user = auth.currentUser
    if (!user || liked) return
    setLiked(true)
    setLikeCount(p => p + 1)
    try {
      await updateDoc(doc(db, 'videos', item.id), { likes: increment(1), likedBy: arrayUnion(user.uid) })
      createNotification({ userId: item.userId, type: 'like', fromUserId: user.uid, videoId: item.id })
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'doubleTapLike' }); setLiked(false); setLikeCount(p => Math.max(0, p - 1)) }
  }, [liked, item.id, item.userId])

  const showLikeHeart = useCallback(() => {
    likeHeartOpacity.setValue(1)
    Animated.sequence([
      Animated.timing(likeHeartOpacity, { toValue: 1.3, duration: 200, useNativeDriver: true }),
      Animated.timing(likeHeartOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [likeHeartOpacity])

  const handleTap = useCallback(() => {
    const now = Date.now()
    if (now - tapState.current.lastTap < 350) {
      if (tapState.current.timer) { clearTimeout(tapState.current.timer); tapState.current.timer = null }
      tapState.current.lastTap = 0
      handleDoubleTapLike()
      showLikeHeart()
    } else {
      tapState.current.lastTap = now
      tapState.current.timer = setTimeout(togglePause, 350)
    }
  }, [handleDoubleTapLike, showLikeHeart, togglePause])

  const handleShare = useCallback(() => {
    isDirty.current = true
    onOpenShare({
      videoId: item.id,
      videoURL: item.videoURL,
      description: item.description,
      onShareAction: async () => {
        setShareCount(p => p + 1)
        try { await updateDoc(doc(db, 'videos', item.id), { shares: increment(1) }) }
        catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'share' }); setShareCount(p => Math.max(0, p - 1)) }
      },
    })
  }, [item, onOpenShare])

  const handleTimeUpdate = useCallback((currentTimeMs: number, durationMs: number) => {
    onPositionUpdate(currentTimeMs)
    if (viewTrackedRef.current) return
    if (durationMs > 0 && currentTimeMs / durationMs >= 0.8) {
      viewTrackedRef.current = true
      markSeenAndIncrementView(item.id)
    }
  }, [item.id, onPositionUpdate])

  const handleFinish = useCallback(() => {
    if (viewTrackedRef.current) return
    viewTrackedRef.current = true
    markSeenAndIncrementView(item.id)
  }, [item.id])

  return (
    <Pressable style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} onPress={handleTap}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <VideoPlayer
          uri={item.videoURL}
          isActive={isActive}
          isTabFocused={isTabFocused}
          isPageActive={isPageActive}
          isPaused={paused}
          savedPosition={savedPosition}
          onReady={onReady ?? (() => {})}
          onTimeUpdate={handleTimeUpdate}
          onFinish={handleFinish}
        />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: likeHeartOpacity, transform: [{ scale: likeHeartOpacity }] }]}
      >
        <View style={{ position: 'absolute', top: '50%', width: '100%', alignItems: 'center', marginTop: -32 }}>
          <Ionicons name="heart" size={72} color={colors.accent} />
        </View>
      </Animated.View>

      {paused && isActive && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: playOpacity }]}>
          <View style={{ position: 'absolute', top: '50%', width: '100%', alignItems: 'center', marginTop: -24 }}>
            <Ionicons name="play-circle" size={64} color={colors.primary} />
          </View>
        </Animated.View>
      )}

      <LinearGradient
        pointerEvents="box-none"
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 400, paddingBottom: bottomPadding }}
      >
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 16, alignItems: 'flex-end' }}>
          <View style={{ flex: 1, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Avatar
                uri={photoURL}
                name={username}
                size={48}
                borderWidth={hasUnseenStory ? 2.5 : 0}
                borderColor={hasUnseenStory ? '#FFD700' : 'transparent'}
              />
              {auth.currentUser?.uid !== item.userId && (
                <FollowButton targetUserId={item.userId} size="sm" initialFollowing={initialFollowing} initialRequested={initialRequested} />
              )}
            </View>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.userId } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Text style={{ fontFamily: 'Georgia', fontWeight: '700', fontSize: 16, color: colors.white }}>
                {username}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="eye-outline" size={12} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.views || 0}</Text>
              </View>
            </TouchableOpacity>
            {item.description ? (
              <Text style={{ color: colors.white, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            {item.hashtags && item.hashtags.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {item.hashtags.map((tag, i) => (
                  <Text key={i} style={{ color: colors.secondary, fontSize: 13, fontWeight: '600' }}>#{tag}</Text>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
                <Ionicons name="musical-note" size={14} color={colors.white} />
              </Animated.View>
              <Text style={{ color: colors.white, fontSize: 12, marginLeft: 5 }} numberOfLines={1}>
                son original — {username}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'center', gap: 16, paddingBottom: 4, transform: [{ translateY: actionOffset }] }}>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleLike}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={40} color={liked ? colors.accent : colors.white} />
              <Text style={{ color: colors.white, fontSize: 14, marginTop: 2 }}>
                {likeCount === 0 ? "J'aime" : likeCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={onPressComments}>
              <Ionicons name="chatbubble-ellipses" size={36} color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 14, marginTop: 2 }}>{commentCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleSave}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={34} color={saved ? colors.accent : colors.white} />
              <Text style={{ color: colors.white, fontSize: 14, marginTop: 2 }}>{saveCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleShare}>
              <Ionicons name="paper-plane-outline" size={34} color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 14, marginTop: 2 }}>
                {shareCount === 0 ? 'Partager' : shareCount}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  )
}

export const VideoItem = memo(VideoItemComponent, (prev, next) => {
  if (prev.item.id !== next.item.id) return false
  if (prev.isActive !== next.isActive) return false
  if (prev.isActive) {
    if (prev.isPageActive !== next.isPageActive) return false
    if (prev.isTabFocused !== next.isTabFocused) return false
  }
  if (prev.initialFollowing !== next.initialFollowing) return false
  return true
})
