import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, FlatList, Dimensions, TouchableOpacity, Text, StyleSheet, Animated, Image, Pressable, ActivityIndicator, Share,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { doc, getDoc, updateDoc, increment, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore'
import { Video, ResizeMode } from 'expo-av'
import { router } from 'expo-router'
import { useIsFocused } from '@react-navigation/native'
import { db, auth } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import CommentModal from '../../src/components/CommentModal'
import MboloLoader from '../../src/components/MboloLoader'
import { useVideoFeed } from '../../src/hooks/useVideoFeed'
import { useVideoPreloader } from '../../src/hooks/useVideoPreloader'
import type { Video as VideoType } from '../../src/types'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')

function VideoItem({ item, isActive, isTabFocused, onPressComments, preloaded }: {
  item: VideoType; isActive: boolean; isTabFocused: boolean; onPressComments: () => void; preloaded: boolean
}) {
  const videoRef = useRef<Video>(null)
  const [paused, setPaused] = useState(false)
  const playOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!isActive || !isTabFocused) setPaused(false)
  }, [isActive, isTabFocused])

  useEffect(() => {
    if (paused && isActive) {
      Animated.timing(playOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    } else {
      playOpacity.setValue(0)
    }
  }, [paused, isActive, playOpacity])

  const [username, setUsername] = useState('utilisateur')
  const [photoURL, setPhotoURL] = useState('')
  const spinValue = useRef(new Animated.Value(0)).current

  const spinInterpolation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  useEffect(() => {
    if (isActive && isTabFocused && !paused) {
      const anim = Animated.loop(
        Animated.timing(spinValue, { toValue: 1, duration: 3000, useNativeDriver: true }),
      )
      anim.start()
      return () => anim.stop()
    }
  }, [isActive, isTabFocused, paused, spinValue])

  useEffect(() => {
    if (!isActive) return
    let cancelled = false
    const fetchUser = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', item.userId))
        if (!cancelled && docSnap.exists()) {
          setUsername(docSnap.data().nom || 'utilisateur')
          setPhotoURL(docSnap.data().photoURL || '')
        }
      } catch {
        if (!cancelled) setUsername('utilisateur')
      }
    }
    fetchUser()
    return () => { cancelled = true }
  }, [item.userId, isActive])

  const [videoLoading, setVideoLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveCount, setSaveCount] = useState(item.saves || 0)
  const [likeCount, setLikeCount] = useState(item.likes || 0)
  const [commentCount, setCommentCount] = useState(item.comments || 0)

  useEffect(() => {
    if (!isActive) return
    let cancelled = false
    const checkLike = async () => {
      const user = auth.currentUser
      if (!user) return
      try {
        const snap = await getDoc(doc(db, 'videos', item.id))
        if (!cancelled && snap.exists()) {
          const data = snap.data()
          setLiked(data.likedBy?.includes(user.uid) ?? false)
          setSaved(data.savedBy?.includes(user.uid) ?? false)
          if (typeof data.saves === 'number') setSaveCount(data.saves)
          if (typeof data.likes === 'number') setLikeCount(data.likes)
        }
      } catch {}
    }
    checkLike()
    return () => { cancelled = true }
  }, [item.id, isActive])

  useEffect(() => {
    if (!isActive || item.id.startsWith('demo-')) return
    const unsub = onSnapshot(doc(db, 'videos', item.id), (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        if (typeof d.comments === 'number') setCommentCount(d.comments)
        if (typeof d.likes === 'number') setLikeCount(d.likes)
        if (typeof d.saves === 'number') setSaveCount(d.saves)
      }
    })
    return () => unsub()
  }, [item.id, isActive])

  const handleLike = useCallback(async () => {
    const user = auth.currentUser
    if (!user) return
    const ref = doc(db, 'videos', item.id)
    if (liked) {
      setLiked(false)
      setLikeCount((p) => Math.max(0, p - 1))
      try { await updateDoc(ref, { likes: increment(-1), likedBy: arrayRemove(user.uid) }) }
      catch { setLiked(true); setLikeCount((p) => p + 1) }
    } else {
      setLiked(true)
      setLikeCount((p) => p + 1)
      try { await updateDoc(ref, { likes: increment(1), likedBy: arrayUnion(user.uid) }) }
      catch { setLiked(false); setLikeCount((p) => Math.max(0, p - 1)) }
    }
  }, [liked, item.id])

  const handleSave = useCallback(async () => {
    const user = auth.currentUser
    if (!user) return
    const ref = doc(db, 'videos', item.id)
    if (saved) {
      setSaved(false)
      setSaveCount((p) => Math.max(0, p - 1))
      try { await updateDoc(ref, { saves: increment(-1), savedBy: arrayRemove(user.uid) }) }
      catch { setSaved(true); setSaveCount((p) => p + 1) }
    } else {
      setSaved(true)
      setSaveCount((p) => p + 1)
      try { await updateDoc(ref, { saves: increment(1), savedBy: arrayUnion(user.uid) }) }
      catch { setSaved(false); setSaveCount((p) => Math.max(0, p - 1)) }
    }
  }, [saved, item.id])

  const handleShare = useCallback(async () => {
    try {
      const result = await Share.share({
        message: `${item.description ? item.description + '\n' : ''}Regarde cette vidéo sur Mbolo ! 🇬🇦\n${item.videoURL}`,
      })
      if (result.action === Share.sharedAction) {
        updateDoc(doc(db, 'videos', item.id), { shares: increment(1) }).catch(() => {})
      }
    } catch {}
  }, [item])

  const togglePause = useCallback(() => setPaused((prev) => !prev), [])

  const handleDoubleTapLike = useCallback(async () => {
    const user = auth.currentUser
    if (!user || liked) return
    setLiked(true)
    setLikeCount((p) => p + 1)
    try { await updateDoc(doc(db, 'videos', item.id), { likes: increment(1), likedBy: arrayUnion(user.uid) }) }
    catch { setLiked(false); setLikeCount((p) => Math.max(0, p - 1)) }
  }, [liked, item.id])

  const tapState = useRef({ lastTap: 0, timer: null as ReturnType<typeof setTimeout> | null })
  const likeHeartOpacity = useRef(new Animated.Value(0)).current

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
      tapState.current.timer = setTimeout(() => { togglePause() }, 350)
    }
  }, [handleDoubleTapLike, showLikeHeart, togglePause])

  return (
    <Pressable style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} onPress={handleTap}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {videoLoading && (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
            <MboloLoader size={48} />
          </View>
        )}
        <Video
          ref={videoRef}
          source={{ uri: item.videoURL }}
          style={[StyleSheet.absoluteFill, { opacity: videoLoading ? 0 : 1 }]}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive && isTabFocused && !paused}
          isLooping
          isMuted={false}
          onLoadStart={() => setVideoLoading(true)}
          onLoad={() => setVideoLoading(false)}
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
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 400, paddingBottom: 50 }}
      >
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 16, alignItems: 'flex-end' }}>
          <View style={{ flex: 1, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Image
                source={{ uri: photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=009A44&color=fff&size=96` }}
                style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.white }}
              />
              <TouchableOpacity
                style={{ marginLeft: 10, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 4 }}
                onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.userId } })}
              >
                <Text style={{ color: colors.white, fontWeight: '700', fontSize: 12 }}>Suivre</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.userId } })}
            >
              <Text style={{ fontFamily: 'Georgia', fontWeight: '700', fontSize: 16, color: colors.white, marginBottom: 2 }}>
                G@B-{username}
              </Text>
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
          <View style={{ alignItems: 'center', gap: 16, paddingBottom: 4, transform: [{ translateY: -85 }] }}>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleLike}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={40} color={liked ? colors.accent : colors.white} />
              <Text style={{ color: colors.white, fontSize: 11, marginTop: 2 }}>{likeCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={onPressComments}>
              <Ionicons name="chatbubble-ellipses" size={36} color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 11, marginTop: 2 }}>{commentCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleSave}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={34} color={saved ? colors.accent : colors.white} />
              <Text style={{ color: colors.white, fontSize: 11, marginTop: 2 }}>{saveCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center' }} onPress={handleShare}>
              <Ionicons name="share-social" size={34} color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 11, marginTop: 2 }}>{item.shares || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  )
}

function TopBar({ feedMode, setFeedMode }: { feedMode: string; setFeedMode: (m: string) => void }) {
  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      paddingTop: 15, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: 'transparent',
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/explore')}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}
        >
          <Ionicons name="search" size={16} color={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
          <TouchableOpacity onPress={() => setFeedMode('pourtoi')}>
            <Text style={{
              fontSize: 14, fontWeight: feedMode === 'pourtoi' ? '700' : '400',
              color: feedMode === 'pourtoi' ? colors.white : 'rgba(255,255,255,0.5)',
            }}>
              Quoi de neuf
            </Text>
            {feedMode === 'pourtoi' && (
              <View style={{ height: 2, backgroundColor: colors.primary, borderRadius: 1, marginTop: 3 }} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFeedMode('suivi')}>
            <Text style={{
              fontSize: 14, fontWeight: feedMode === 'suivi' ? '700' : '400',
              color: feedMode === 'suivi' ? colors.white : 'rgba(255,255,255,0.5)',
            }}>
              Suivi
            </Text>
            {feedMode === 'suivi' && (
              <View style={{ height: 2, backgroundColor: colors.primary, borderRadius: 1, marginTop: 3 }} />
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/camera')}
          style={{
            width: 40, height: 40, borderRadius: 20, marginTop: 20,
            backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
            shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4, shadowRadius: 6, elevation: 6,
          }}
        >
          <Ionicons name="add" size={26} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function Feed() {
  const { videos, currentIndex, setCurrentIndex, loadMore, loading, hasMore, commentsCache } = useVideoFeed(10, feedMode)
  const { getPreloadedVideo } = useVideoPreloader(videos, currentIndex)
  const [feedMode, setFeedMode] = useState('pourtoi')
  const [commentVideoId, setCommentVideoId] = useState<string | null>(null)
  const [scrollEnabled, setScrollEnabled] = useState(true)
  const flatListRef = useRef<FlatList>(null)
  const isTabFocused = useIsFocused()

  useEffect(() => {
    setScrollEnabled(!commentVideoId)
  }, [commentVideoId])

  const openComments = useCallback((videoId: string) => setCommentVideoId(videoId), [])
  const closeComments = useCallback(() => setCommentVideoId(null), [])

  const onViewableItemsChanged = useRef(({ changed }: { changed: any[] }) => {
    const visible = changed.find((c: any) => c.isViewable)
    if (visible) setCurrentIndex(visible.index)
  }).current

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 100,
  }).current

  const renderItem = useCallback(({ item, index }: { item: VideoType; index: number }) => {
    const preloadInfo = getPreloadedVideo(index)
    return (
      <VideoItem
        item={item}
        isActive={index === currentIndex}
        isTabFocused={isTabFocused}
        onPressComments={() => openComments(item.id)}
        preloaded={preloadInfo?.preloaded ?? false}
      />
    )
  }, [currentIndex, isTabFocused, openComments, getPreloadedVideo])

  const keyExtractor = useCallback((item: VideoType) => item.id, [])

  const listFooter = useMemo(() => {
    if (hasMore) {
      return (
        <View style={{ height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.black }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 12 }}>Chargement...</Text>
        </View>
      )
    }
    return (
      <View style={{ height: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.black }}>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>— Plus aucune vidéo —</Text>
      </View>
    )
  }, [hasMore])

  if (videos.length === 0) {
    if (loading) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <MboloLoader size={48} />
        </SafeAreaView>
      )
    }
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="film-outline" size={64} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 18, marginTop: 16 }}>
          {feedMode === 'suivi' ? 'Tu ne suis personne encore' : 'Aucune vidéo pour le moment'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8 }}>
          {feedMode === 'suivi' ? 'Explore pour trouver des créateurs' : 'Sois le premier à poster ! 🇬🇦'}
        </Text>
      </SafeAreaView>
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
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        removeClippedSubviews={false}
        ListFooterComponent={listFooter}
      />
      <TopBar feedMode={feedMode} setFeedMode={setFeedMode} />
      <CommentModal
        visible={commentVideoId !== null}
        onClose={closeComments}
        videoId={commentVideoId || ''}
      />
    </View>
  )
}
