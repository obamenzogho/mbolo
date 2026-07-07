import { memo, useCallback, useRef, useState } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { auth } from '@/lib/firebase'

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
}

function FeedItemComponent({
  item, index, instanceId = 'feed',
  onPressComment, onPressShare, onPressMore, onLongPress,
  username, userPhotoURL, isActive: isActiveProp,
}: FeedItemProps) {
  const isActive = isActiveProp ?? false
  const insets = useSafeAreaInsets()
  const player = usePlayerForVideo(instanceId, item.id)

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

  const handleLikePress = useCallback(() => { toggleLike(); animateLikeIcon() }, [toggleLike, animateLikeIcon])
  const handleComment = useCallback(() => onPressComment?.(item.id), [onPressComment, item.id])
  const handleShare = useCallback(() => onPressShare?.(item.id), [onPressShare, item.id])
  const handleMore = useCallback(() => onPressMore?.(item.id), [onPressMore, item.id])

  const BOTTOM_ACTIONS = 80
  const BOTTOM_PROGRESS = BOTTOM_ACTIONS - 15
  const BOTTOM_PADDING = BOTTOM_ACTIONS + 7

  return (
    <View style={styles.container}>
      <VideoPlayerSlot videoId={item.id} instanceId={instanceId} thumbnailURL={item.thumbnailURL} />

      <VideoOverlay
        player={player}
        onDoubleTapLike={() => toggleLike({ force: true })}
        onLongPress={onLongPress}
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

      <View style={[styles.infoColumn, { bottom: BOTTOM_PADDING + insets.bottom }]}>
        <AuthorInfo item={item} username={username} userPhotoURL={userPhotoURL} />
        <CaptionBlock description={item.description} hashtags={item.hashtags} />
        <CommentPreview item={item} onPressComment={onPressComment} />
      </View>

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

      <ProgressBar player={player} bottomOffset={BOTTOM_PROGRESS} />
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
  container: { flex: 1, backgroundColor: '#000' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220 },
  infoColumn: { position: 'absolute', left: 12, right: 80 },
  actionColumn: { position: 'absolute', right: 8, alignItems: 'center' },
  toast: {
    position: 'absolute', top: '45%', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
})
