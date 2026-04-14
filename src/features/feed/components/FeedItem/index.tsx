import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { auth } from '@/lib/firebase'
import { useTabBarVisibility } from '@/contexts/TabBarVisibilityContext'

import { VideoPlayerSlot, usePlayerForVideo } from '../VideoPlayerSlot'
import { RepostedByBanner } from '@/features/repost/components/RepostedByBanner'

import { VideoOverlay } from './VideoOverlay'
import { AuthorInfo } from './AuthorInfo'
import { CaptionBlock } from './CaptionBlock'
import { CommentPreview } from './CommentPreview'
import { ActionBar } from './ActionBar'
import { ProgressBar } from './ProgressBar'
import { useFeedItemActions } from './useFeedItemActions'

import type { Video } from '@/types'

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
  itemHeight?: number
  commentsOpen?: boolean
  // Mode immersif (auto-masquage navbar + descente du bloc info après 5 s).
  // Désactivé dans les contextes SANS navbar (ex. viewer plein écran du profil
  // ou de l'onglet « à proximité »), où le bloc doit rester ancré en bas.
  immersive?: boolean
}

function FeedItemComponent({
  item, index, instanceId = 'feed',
  onPressComment, onPressShare, onPressMore, onLongPress,
  username, userPhotoURL, isActive: isActiveProp, itemHeight, commentsOpen = false,
  immersive = true,
}: FeedItemProps) {
  const isActive = isActiveProp ?? false
  const insets = useSafeAreaInsets()
  const player = usePlayerForVideo(instanceId, item.id)
  const { hideTabBar, showTabBar } = useTabBarVisibility()

  const { liked, saved, likeCount, saveCount, toggleLike, toggleSave } = useFeedItemActions(item)

  const [likeIconScale] = useState(() => new Animated.Value(1))
  const animateLikeIcon = useCallback(() => {
    likeIconScale.setValue(1)
    Animated.spring(likeIconScale, { toValue: 1.4, useNativeDriver: true, friction: 3 }).start(() => {
      Animated.spring(likeIconScale, { toValue: 1, useNativeDriver: true, friction: 3 }).start()
    })
  }, [likeIconScale])

  const [repostToast, setRepostToast] = useState<string | null>(null)
  const repostToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const handleRepostToggle = useCallback((reposted: boolean) => {
    setRepostToast(reposted ? 'Vidéo republiée' : 'Republication retirée')
    clearTimeout(repostToastTimer.current)
    repostToastTimer.current = setTimeout(() => setRepostToast(null), 2000)
  }, [])

  const commentOpacity = useRef(new Animated.Value(1)).current
  const commentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [commentVisible, setCommentVisible] = useState(true)

  useEffect(() => {
    if (isActive) {
      commentOpacity.setValue(1)
      setCommentVisible(true)
      clearTimeout(commentTimer.current)
      commentTimer.current = setTimeout(() => {
        Animated.timing(commentOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          setCommentVisible(false)
        })
      }, 5000)
    } else {
      clearTimeout(commentTimer.current)
      commentOpacity.setValue(1)
      setCommentVisible(true)
    }
    return () => clearTimeout(commentTimer.current)
  }, [isActive, commentOpacity])

  useEffect(() => {
    if (!player) return
    if (!isActive) {
      try { player.pause() } catch {}
      try { player.volume = 0 } catch {}
    }
  }, [isActive, player])

  /* ── Mode immersif : après 5 s de visionnage, la navbar principale se masque
     et le bloc info descend pour occuper l'espace libéré. Au toucher de l'écran,
     tout se réaffiche, puis le cycle recommence. ── */
  const IMMERSIVE_SHIFT = 64 // hauteur visible de la navbar (hors safe area)
  const immersiveShift = useRef(new Animated.Value(0)).current
  const immersiveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const enterImmersive = useCallback(() => {
    hideTabBar()
    Animated.timing(immersiveShift, {
      toValue: IMMERSIVE_SHIFT, duration: 300, useNativeDriver: true,
    }).start()
  }, [hideTabBar, immersiveShift])

  const exitImmersive = useCallback(() => {
    showTabBar()
    Animated.timing(immersiveShift, {
      toValue: 0, duration: 200, useNativeDriver: true,
    }).start()
  }, [showTabBar, immersiveShift])

  const scheduleImmersive = useCallback(() => {
    clearTimeout(immersiveTimer.current)
    immersiveTimer.current = setTimeout(enterImmersive, 5000)
  }, [enterImmersive])

  // Démarre / relance le cycle quand la vidéo est active ET que les commentaires
  // sont fermés. Suspend le cycle (timer annulé, décalage remis à zéro) tant que
  // les commentaires sont ouverts, et restaure tout quand la vidéo n'est plus
  // active (scroll, perte de focus…).
  // Hors mode immersif (viewer sans navbar) : jamais de masquage, bloc ancré.
  useEffect(() => {
    if (!immersive) {
      clearTimeout(immersiveTimer.current)
      // Pas de navbar dans ce contexte → on descend le bloc (de façon STATIQUE)
      // pour qu'il occupe l'espace du bas, sans cycle ni animation.
      immersiveShift.setValue(IMMERSIVE_SHIFT)
      return
    }
    if (isActive && !commentsOpen) {
      // On (re)part toujours d'un état visible avant de lancer le compte à
      // rebours — au cas où la navbar aurait été laissée masquée.
      showTabBar()
      immersiveShift.setValue(0)
      scheduleImmersive()
    } else {
      clearTimeout(immersiveTimer.current)
      if (commentsOpen) {
        // Le CommentSheet gère déjà la navbar ; on remet juste le bloc en place.
        immersiveShift.setValue(0)
      } else {
        showTabBar()
        immersiveShift.setValue(0)
      }
    }
    return () => clearTimeout(immersiveTimer.current)
  }, [immersive, isActive, commentsOpen, scheduleImmersive, showTabBar, immersiveShift])

  // Un toucher réaffiche tout et relance le compte à rebours de 5 s.
  const handleInteraction = useCallback(() => {
    if (!immersive || !isActive || commentsOpen) return
    exitImmersive()
    scheduleImmersive()
  }, [immersive, isActive, commentsOpen, exitImmersive, scheduleImmersive])

  const handleLikePress = useCallback(() => { toggleLike(); animateLikeIcon() }, [toggleLike, animateLikeIcon])
  const handleComment = useCallback(() => onPressComment?.(item.id), [onPressComment, item.id])
  const handleShare = useCallback(() => onPressShare?.(item.id), [onPressShare, item.id])
  const handleMore = useCallback(() => onPressMore?.(item.id), [onPressMore, item.id])

  const BOTTOM_ACTIONS = 80
  const BOTTOM_PROGRESS = BOTTOM_ACTIONS - 15
  const BOTTOM_PADDING = BOTTOM_ACTIONS + 7

  return (
    <View style={[styles.container, itemHeight ? { height: itemHeight } : undefined]}>
      <VideoPlayerSlot videoId={item.id} instanceId={instanceId} thumbnailURL={item.thumbnailURL} />

      <VideoOverlay
        player={player}
        onDoubleTapLike={() => toggleLike({ force: true })}
        onLongPress={onLongPress}
        onInteraction={handleInteraction}
      />

      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.gradient}
      />

      {item.latestRepostedBy && (
        <RepostedByBanner
          repostedBy={item.repostedBy ?? []}
          currentUserId={auth.currentUser?.uid ?? ''}
          reposterName={item.latestRepostedBy.userName}
          reposterId={item.latestRepostedBy.userId}
        />
      )}

      {repostToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{repostToast}</Text>
        </View>
      )}

      <Animated.View style={[styles.infoColumn, { bottom: BOTTOM_PADDING + insets.bottom, transform: [{ translateY: immersiveShift }] }]}>
        <AuthorInfo item={item} username={username} userPhotoURL={userPhotoURL} hashtags={item.hashtags} />
        <CaptionBlock description={item.description} />
        {item.place && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: item.place! } })}
            style={styles.locationPill}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={13} color="#fff" />
            <Text style={styles.locationText}>{item.place}</Text>
          </TouchableOpacity>
        )}
        {commentVisible && (
          <Animated.View style={{ opacity: commentOpacity }}>
            <CommentPreview item={item} onPressComment={onPressComment} />
          </Animated.View>
        )}
      </Animated.View>

      <View style={[styles.actionColumn, { bottom: BOTTOM_PADDING + insets.bottom }]}>
        <ActionBar
          liked={liked}
          saved={saved}
          likeCount={likeCount}
          saveCount={saveCount}
          commentCount={item.comments}
          likeIconScale={likeIconScale}
          onLike={handleLikePress}
          onSave={toggleSave}
          onComment={handleComment}
          onShare={handleShare}
          onMore={handleMore}
          onRepostToggle={handleRepostToggle}
          video={item}
        />
      </View>

      <ProgressBar player={player} bottomOffset={BOTTOM_PROGRESS} translateY={immersiveShift} />
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
  if (prev.commentsOpen !== next.commentsOpen) return false
  if (prev.immersive !== next.immersive) return false
  return true
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220 },
  infoColumn: { position: 'absolute', left: 12, right: 80, flexDirection: 'column-reverse', alignItems: 'flex-start' },
  actionColumn: { position: 'absolute', right: 8, alignItems: 'center', zIndex: 20, elevation: 20 },
  toast: {
    position: 'absolute', top: '45%', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 4, marginTop: 6, alignSelf: 'flex-start',
  },
  locationText: { color: '#fff', fontSize: 12, fontWeight: '500' },
})
