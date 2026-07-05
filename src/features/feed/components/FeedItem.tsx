import { memo, useCallback, useRef, useState, useEffect } from 'react'
import { View, Text, Animated, TouchableOpacity, Pressable, PanResponder, useWindowDimensions, StyleSheet, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import type { EventSubscription } from 'expo-modules-core'
import { auth } from '../../../lib/firebase'
import { updateDoc, doc, increment, setDoc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { createNotification } from '../../../lib/notifications'
import { captureException } from '../../../lib/sentry'
import { recordWatch } from '../services/watchTracker'
import { colors } from '../../../lib/theme'

import { VideoPlayerSlot, usePlayerForVideo } from './VideoPlayerSlot'
import { RepostButton } from '@/features/repost/components/RepostButton'
import { RepostedByBanner } from '@/features/repost/components/RepostedByBanner'
import { useFollowFast } from '@/hooks/useFollowFast'
import { useFollowAction } from '@/hooks/useFollowAction'
import { ShareButton } from '@/features/share/components/ShareButton'
import type { Video } from '../../../types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface FeedItemProps {
  item: Video
  index: number
  instanceId?: string
  onPressComment?: (videoId: string) => void
  onPressShare?: (videoId: string) => void
  onPressMore?: (videoId: string) => void
  onLongPress?: () => void
  username?: string
  userPhotoURL?: string
  isActive?: boolean
}

function FeedItemComponent({ item, index, instanceId = 'feed', onPressComment, onPressShare, onPressMore, onLongPress, username, userPhotoURL, isActive: isActiveProp }: FeedItemProps) {
  const isActive = isActiveProp ?? false
  const currentUserId = auth.currentUser?.uid ?? ''
  const displayName = item.userName ?? username ?? 'Utilisateur'
  const avatarURL = item.userPhotoURL || userPhotoURL
  const isOwn = item.userId === currentUserId
  const insets = useSafeAreaInsets()
  const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = useWindowDimensions()
  const BOTTOM_ACTIONS = 80
  const BOTTOM_PROGRESS = BOTTOM_ACTIONS - 15
  const BOTTOM_PADDING = BOTTOM_ACTIONS + 7
  const player = usePlayerForVideo(instanceId, item.id)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likeCount, setLikeCount] = useState(item.likes)
  const [saveCount, setSaveCount] = useState(item.saves)
  const [commentCount, setCommentCount] = useState(item.comments)
  const [showFullDesc, setShowFullDesc] = useState(false)
  const [gestureIcon, setGestureIcon] = useState<'play' | 'pause'>('play')
  const [isPlaying, setIsPlaying] = useState(true)
  const [likeHeartOpacity] = useState(() => new Animated.Value(0))
  const [likeHeartScale] = useState(() => new Animated.Value(0.5))
  const [likeIconScale] = useState(() => new Animated.Value(1))
  const [repostToast, setRepostToast] = useState<string | null>(null)
  const repostToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [followState, setFollowState] = useState<'idle' | 'done' | 'hidden'>('idle')
  const followTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { isFollowing } = useFollowFast(item.userId)
  const { toggleFollow: doToggleFollow } = useFollowAction()
  const isDirty = useRef(false)
  const isPausedRef = useRef(false)
  const [gesturePlayOpacity] = useState(() => new Animated.Value(0))
  const [gestureSeekLeftOpacity] = useState(() => new Animated.Value(0))
  const [gestureSeekRightOpacity] = useState(() => new Animated.Value(0))
  const [progressAnim] = useState(() => new Animated.Value(0))
  const progressValueRef = useRef(0)
  const [barOpacity] = useState(() => new Animated.Value(1))
  const [isSeeking, setIsSeeking] = useState(false)
  const isSeekingRef = useRef(false)
  isSeekingRef.current = isSeeking
  const wasPlayingBeforeSeekRef = useRef(false)
  const barWidthRef = useRef(SCREEN_WIDTH)
  const [seekInfo, setSeekInfo] = useState<{ label: string; x: number } | null>(null)
  const [discRotation] = useState(() => new Animated.Value(0))
  const replayCountRef = useRef(0)

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    let cancelled = false
    getDoc(doc(db, 'videos', item.id, 'likes', uid)).then((s) => { if (!cancelled) setLiked(s.exists()) })
    getDoc(doc(db, 'videos', item.id, 'saves', uid)).then((s) => { if (!cancelled) setSaved(s.exists()) })
    return () => { cancelled = true }
  }, [item.id])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'videos', item.id), (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        if (typeof d.comments === 'number') setCommentCount(d.comments)
      }
    })
    return () => unsub()
  }, [item.id])

  useEffect(() => {
    if (!player || !isActive) {
      progressValueRef.current = 0
      isPausedRef.current = true
      setIsPlaying(false)
      try { progressAnim.setValue(0) } catch {}
      return
    }

    const setProgress = (ratio: number) => {
      const nextRatio = Math.max(0, Math.min(1, ratio))
      progressValueRef.current = nextRatio
      try { progressAnim.setValue(nextRatio) } catch {}
    }

    const syncProgress = () => {
      if (isSeekingRef.current) return
      const dur = player.duration
      if (dur && dur > 0) {
        setProgress(player.currentTime / dur)
      }
    }

    isPausedRef.current = !player.playing
    setIsPlaying(player.playing)
    syncProgress()
    player.timeUpdateEventInterval = 0.1

    const subscriptions: EventSubscription[] = [
      player.addListener('timeUpdate', ({ currentTime }) => {
        if (isSeekingRef.current) return
        const dur = player.duration
        if (dur && dur > 0) {
          setProgress(currentTime / dur)
        }
      }),
      player.addListener('playingChange', ({ isPlaying: nextPlaying }) => {
        isPausedRef.current = !nextPlaying
        setIsPlaying(nextPlaying)
      }),
      player.addListener('sourceChange', () => {
        setProgress(0)
      }),
      player.addListener('playToEnd', () => {
        replayCountRef.current += 1
      }),
    ]

    return () => {
      for (const sub of subscriptions) sub.remove()
      try { player.timeUpdateEventInterval = 0 } catch {}
      setProgress(0)
    }
  }, [isActive, player, progressAnim, item.id])

  useEffect(() => {
    return () => {
      if (!player) return
      const dur = player.duration
      if (dur > 0) {
        const ratio = Math.min(1, player.currentTime / dur)
        recordWatch(item.id, ratio, replayCountRef.current > 0)
      }
    }
  }, [isActive, player, item.id])

  useEffect(() => {
    if (isPlaying && !isSeeking) {
      const timer = setTimeout(() => {
        Animated.timing(barOpacity, { toValue: 0.3, duration: 500, useNativeDriver: true }).start()
      }, 1500)
      return () => clearTimeout(timer)
    } else {
      barOpacity.setValue(1)
    }
  }, [isPlaying, isSeeking, barOpacity])

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
    const now = Date.now()
    if (now - lastTapRef.current < 350) return
    isDirty.current = true
    const user = auth.currentUser
    if (!user) return
    const videoRef = doc(db, 'videos', item.id)
    const likeRef = doc(db, 'videos', item.id, 'likes', user.uid)

    if (liked) {
      setLiked(false); setLikeCount((p) => Math.max(0, p - 1))
      try {
        await deleteDoc(likeRef)
        await updateDoc(videoRef, { likes: increment(-1) })
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'unlike' })
        setLiked(true); setLikeCount((p) => p + 1)
      }
    } else {
      setLiked(true); setLikeCount((p) => p + 1)
      try {
        await setDoc(likeRef, { createdAt: Date.now() })
        await updateDoc(videoRef, { likes: increment(1) })
        createNotification({ userId: item.userId, type: 'like', fromUserId: user.uid, videoId: item.id })
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'like' })
        setLiked(false); setLikeCount((p) => Math.max(0, p - 1))
      }
    }
  }, [liked, item.id, item.userId])

  const handleDoubleTapLike = useCallback(async () => {
    const user = auth.currentUser
    if (!user || liked) return
    setLiked(true)
    setLikeCount((p) => p + 1)
    try {
      await setDoc(doc(db, 'videos', item.id, 'likes', user.uid), { createdAt: Date.now() })
      await updateDoc(doc(db, 'videos', item.id), { likes: increment(1) })
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
    const videoRef = doc(db, 'videos', item.id)
    const saveRef = doc(db, 'videos', item.id, 'saves', user.uid)

    if (saved) {
      setSaved(false)
      setSaveCount((p) => Math.max(0, p - 1))
      try {
        await deleteDoc(saveRef)
        await updateDoc(videoRef, { saves: increment(-1) })
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'unsave' })
        setSaved(true); setSaveCount((p) => p + 1)
      }
    } else {
      setSaved(true)
      setSaveCount((p) => p + 1)
      try {
        await setDoc(saveRef, { createdAt: Date.now() })
        await updateDoc(videoRef, { saves: increment(1) })
      } catch (e) {
        captureException(e instanceof Error ? e : new Error(String(e)), { context: 'save' })
        setSaved(false); setSaveCount((p) => Math.max(0, p - 1))
      }
    }
  }, [saved, item.id])

  const handleShare = useCallback(() => {
    onPressShare?.(item.id)
  }, [item.id, onPressShare])

  const handleMore = useCallback(() => {
    onPressMore?.(item.id)
  }, [item.id, onPressMore])

  const handleFollow = useCallback(() => {
    if (followState !== 'idle') return
    doToggleFollow(item.userId)
    setFollowState('done')
    clearTimeout(followTimer.current)
    followTimer.current = setTimeout(() => setFollowState('hidden'), 2000)
  }, [followState, doToggleFollow, item.userId])

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
    try {
      barOpacity.setValue(1)
      setIsSeeking(false)
      if (isPausedRef.current) {
        player.play()
        isPausedRef.current = false
        setIsPlaying(true)
        setSeekInfo(null)
        setGestureIcon('pause')
      } else {
        player.pause()
        isPausedRef.current = true
        setIsPlaying(false)
        setGestureIcon('play')
      }
      showGestureIcon('play')
    } catch {}
  }, [player, showGestureIcon, item.id, barOpacity])

  const handleLongPressAction = useCallback(() => {
    if (!player) return
    try { player.pause() } catch {}
    isPausedRef.current = true
    onLongPress?.()
  }, [player, item.id, onLongPress])

  const seekBeginRef = useRef<() => void>(() => {})
  const seekUpdateRef = useRef<(ratio: number) => void>(() => {})
  const seekEndRef = useRef<() => void>(() => {})

  const handleSeekBegin = useCallback(() => {
    isSeekingRef.current = true
    setIsSeeking(true)
    wasPlayingBeforeSeekRef.current = player?.playing ?? false
    barOpacity.setValue(1)
    if (!player) return
    try {
      if (player.playing) {
        player.pause()
        isPausedRef.current = true
      }
    } catch {}
  }, [player, barOpacity])

  const handleSeekUpdate = useCallback((ratio: number) => {
    if (!player) return
    try {
      const dur = player.duration
      if (!dur || dur <= 0) return
      const newTime = ratio * dur
      progressValueRef.current = ratio
      progressAnim.setValue(ratio)
      const totalSecs = Math.round(newTime)
      const m = Math.floor(totalSecs / 60)
      const s = totalSecs % 60
      setSeekInfo({ label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, x: ratio * barWidthRef.current })
    } catch {}
  }, [player, progressAnim])

  const handleSeekEnd = useCallback(() => {
    isSeekingRef.current = false
    setIsSeeking(false)
    setSeekInfo(null)
    if (player) {
      try {
        const dur = player.duration
        if (dur && dur > 0) {
          player.currentTime = progressValueRef.current * dur
        }
      } catch {}
    }
    if (wasPlayingBeforeSeekRef.current && player) {
      try {
        player.play()
        isPausedRef.current = false
        setIsPlaying(true)
      } catch {}
    } else {
      setIsPlaying(false)
    }
  }, [player, progressAnim])

  seekBeginRef.current = handleSeekBegin
  seekUpdateRef.current = handleSeekUpdate
  seekEndRef.current = handleSeekEnd

  const seekPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        if (Math.abs(g.dx) > 5) {
          seekGestureTakenRef.current = true
          return true
        }
        return false
      },
      onPanResponderGrant: (evt) => {
        seekBeginRef.current()
        const locX = evt.nativeEvent?.locationX ?? 0
        const ratio = Math.max(0, Math.min(1, locX / barWidthRef.current))
        seekUpdateRef.current(ratio)
      },
      onPanResponderMove: (_, g) => {
        const ratio = Math.max(0, Math.min(1, g.moveX / barWidthRef.current))
        seekUpdateRef.current(ratio)
      },
      onPanResponderRelease: () => {
        seekGestureTakenRef.current = false
        seekEndRef.current()
      },
      onPanResponderTerminate: () => {
        seekGestureTakenRef.current = false
        seekEndRef.current()
      },
    })
  ).current

  const lastTapRef = useRef(0)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const seekGestureTakenRef = useRef(false)

  const handleTouchStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = undefined
      handleLongPressAction()
    }, 500)
  }, [handleLongPressAction])

  const handleTouchEnd = useCallback(() => {
    if (seekGestureTakenRef.current) { seekGestureTakenRef.current = false; return }
    if (!longPressTimerRef.current) return
    clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = undefined

    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      handleTogglePlay()
      handleDoubleTapLike()
      showLikeHeart()
      animateLikeIcon()
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
      handleTogglePlay()
    }
  }, [handleTogglePlay, handleDoubleTapLike, showLikeHeart, animateLikeIcon])

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    }
  }, [])

  const SPEEDS = [
    { label: '0.5×', value: 0.5 },
    { label: '0.75×', value: 0.75 },
    { label: 'Normal', value: 1 },
    { label: '1.5×', value: 1.5 },
    { label: '2×', value: 2 },
  ]

  const formatCount = (count: number) => count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count

  return (
    <View style={{ flex: 1, height: SCREEN_HEIGHT - insets.bottom, backgroundColor: '#000' }}>

      {/* 1. Vidéo — fond, aucun zIndex */}
      <View style={StyleSheet.absoluteFill}>
        <VideoPlayerSlot videoId={item.id} instanceId={instanceId} thumbnailURL={item.thumbnailURL} />
      </View>

      {/* 2. Calque gestes — DERRIÈRE, trimmé à droite ET en bas */}
      <Pressable
        style={[StyleSheet.absoluteFill, { right: 80, bottom: BOTTOM_PADDING + insets.bottom, zIndex: 0 }]}
        onPressIn={handleTouchStart}
        onPressOut={handleTouchEnd}
      />

      {/* 3. Overlays visuels — transparents aux touches */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', opacity: likeHeartOpacity }]}>
        <Animated.View style={{ transform: [{ scale: likeHeartScale }] }}>
          <Ionicons name="heart" size={100} color="#FFD700" />
        </Animated.View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', opacity: gesturePlayOpacity }]}>
        <Ionicons name={gestureIcon} size={70} color={colors.textOnMedia} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 60, opacity: gestureSeekLeftOpacity }]}>
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="play-back" size={40} color="#fff" />
          <Text style={{ color: colors.white, fontWeight: '700' }}>−5s</Text>
        </View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'flex-end', paddingRight: 60, opacity: gestureSeekRightOpacity }]}>
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="play-forward" size={40} color="#fff" />
          <Text style={{ color: colors.white, fontWeight: '700' }}>+5s</Text>
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

      {/* 4. Bloc contenu — zIndex: 20, box-none */}
      <LinearGradient
        pointerEvents="box-none"
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: BOTTOM_PADDING + insets.bottom, paddingHorizontal: 12, zIndex: 20 }}
      >
        {/* Toast republié */}
        {repostToast && (
          <View style={{ backgroundColor: '#00C853', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 6, alignSelf: 'flex-start' }}>
            <Text style={{ color: colors.white, fontSize: 12 }}>{repostToast}</Text>
          </View>
        )}

        {/* Ligne user + follow */}
        <View style={styles.userRow}>
          <View style={styles.avatarWrapper}>
            {!isOwn && !isFollowing && followState !== 'hidden' && (
              <TouchableOpacity style={styles.followBtn} onPress={handleFollow}>
                <Ionicons name={followState === 'done' ? 'checkmark' : 'add'} size={16} color={colors.save} />
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

          <TouchableOpacity
            style={styles.userNameBlock}
            onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.userId } })}
          >
            <Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>@{displayName}</Text>
          </TouchableOpacity>
        </View>

        {/* Description */}
        {item.description ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setShowFullDesc((p) => !p)}>
            <Text numberOfLines={showFullDesc ? undefined : 2} style={{ color: colors.white, fontSize: 14, marginTop: 6 }}>
              {item.description}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Hashtags */}
        {item.hashtags?.length > 0 ? (
          <Text style={{ color: colors.secondary, fontSize: 14, marginTop: 4 }}>
            {item.hashtags.map((t) => '#' + t).join(' ')}
          </Text>
        ) : null}

        {/* Aperçu commentaires */}
        {item.previewComments && item.previewComments.length > 0 && (
          <View style={{ marginTop: 8 }}>
            {item.previewComments.slice(0, 2).map((pc, i) => (
              <Text key={i} numberOfLines={1} style={{ color: colors.textOnMedia, fontSize: 13 }}>
                <Text style={{ fontWeight: '700' }}>{pc.authorName}</Text> {pc.text}
              </Text>
            ))}
            {commentCount > (item.previewComments?.length ?? 0) && (
              <TouchableOpacity onPress={onPressComment ? () => onPressComment(item.id) : undefined}>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                    Voir les {commentCount} commentaire{commentCount > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Son original */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          {avatarURL ? (
            <View style={{ width: 24, height: 24 }}>
              <Animated.Image
                source={{ uri: avatarURL }}
                style={{ width: '100%', height: '100%', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', transform: [{ rotate: discRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
              />
              <View style={{ position: 'absolute', top: 8, left: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }} />
            </View>
          ) : (
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="musical-notes" size={12} color="#FFF" />
            </View>
          )}
          <Text style={{ color: colors.white, fontSize: 13, marginLeft: 8 }} numberOfLines={1}>
            Son original · {displayName}
          </Text>
        </View>
      </LinearGradient>

      {/* 5. Colonne actions — DEVANT tout (zIndex + elevation pour Android) */}
      <View style={{ position: 'absolute', right: 8, bottom: BOTTOM_PADDING + insets.bottom + 20, alignItems: 'center', zIndex: 30, elevation: 30 }} pointerEvents="auto">
        <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }} onPress={() => { handleLike(); animateLikeIcon() }}>
          <Animated.View style={{ transform: [{ scale: likeIconScale }] }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={34} color={liked ? colors.like : colors.white} />
          </Animated.View>
          <Text style={{ color: colors.white, fontSize: 12 }}>{likeCount > 0 ? formatCount(likeCount) : "J'aime"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }} onPress={onPressComment ? () => onPressComment(item.id) : undefined}>
          <Ionicons name="chatbubble-outline" size={32} color={colors.white} />
          <Text style={{ color: colors.white, fontSize: 12 }}>{commentCount > 0 ? formatCount(commentCount) : 'Écrire'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }} onPress={handleSave}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={30} color={saved ? colors.save : colors.white} />
          <Text style={{ color: colors.white, fontSize: 12 }} numberOfLines={1}>{saveCount > 0 ? formatCount(saveCount) : 'Sauve'}</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <RepostButton
            video={item}
            size={30}
            showLabel
            onRepost={(reposted) => {
              const msg = reposted ? 'Vidéo republiée' : 'Republication retirée'
              setRepostToast(msg)
              clearTimeout(repostToastTimer.current)
              repostToastTimer.current = setTimeout(() => setRepostToast(null), 2000)
            }}
          />
        </View>

        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <ShareButton onPress={handleShare} size={30} />
        </View>

        <TouchableOpacity style={{ alignItems: 'center', marginTop: 18 }} onPress={handleMore}>
          <Ionicons name="ellipsis-horizontal" size={30} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* 6. Barre de seek — zIndex: 10, coupée à right: 80 pour libérer la colonne actions */}
      {player && (
        <Animated.View
          {...seekPanResponder.panHandlers}
          onLayout={(e) => { barWidthRef.current = e.nativeEvent.layout.width }}
          style={{ position: 'absolute', bottom: BOTTOM_PROGRESS + insets.bottom, left: 0, right: 80, height: 60, justifyContent: 'flex-end', opacity: barOpacity, zIndex: 10 }}
        >
          {/* Track background */}
          <View style={{ height: isPlaying ? 2 : 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginHorizontal: 16 }}>
            <Animated.View style={{ height: '100%', backgroundColor: colors.progress, borderRadius: 3, width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
          </View>

          {/* Thumb + time label */}
          {(!isPlaying || isSeeking) && (
            <>
              <Animated.View
                style={{
                  position: 'absolute',
                  bottom: 60 / 2 - 8,
                  left: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [16, SCREEN_WIDTH - 16] }),
                  width: 16, height: 16, borderRadius: 8,
                  backgroundColor: colors.progress, borderWidth: 2, borderColor: colors.white,
                  transform: [{ translateX: -8 }],
                  elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2,
                }}
              />
              {seekInfo && (
                <View style={{ position: 'absolute', bottom: 24, left: seekInfo.x, transform: [{ translateX: -30 }], alignItems: 'center' }}>
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                    <Text style={{ color: colors.white, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{seekInfo.label}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </Animated.View>
      )}
    </View>
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
    overflow: 'visible',
  },
  avatarWrapper: {
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
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
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.save,
    zIndex: 1,
  },
  userNameBlock: {
    flex: 1,
    height: 44,
    justifyContent: 'flex-end',
    marginLeft: 10,
  },
})
