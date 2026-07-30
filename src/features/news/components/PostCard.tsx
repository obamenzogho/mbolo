import { memo, useCallback, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Share,
  StyleSheet,
  useWindowDimensions,
  Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { doc, runTransaction, increment, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { colors } from '@/lib/theme'
import { getAvatarImageUrl, getFeedImageUrl } from '@/lib/cloudinary'
import { useNewsRepost } from '../hooks/useNewsRepost'
import RichPostText from './RichPostText'
import ImageGalleryModal from './ImageGalleryModal'
import PollView from './PollView'
import { ReactionPicker } from './ReactionPicker'
import { useReactions } from '../hooks/useReactions'
import { REACTION_EMOJI, POST_BACKGROUNDS } from '../types'
import type { NewsPost, NewsPostMedia, PostReactionType } from '../types'

interface PostCardProps {
  post: NewsPost
  currentUserId: string
  onComment: (post: NewsPost) => void
  onSave?: (postId: string) => void
  onEdit: (post: NewsPost) => void
  onDelete: (post: NewsPost) => void
  onMore: (post: NewsPost) => void
  onRepost?: (postId: string, reposted: boolean, count: number) => void
  onPress?: (post: NewsPost) => void
}

function timeAgo(date: Date): string {
  const seconds = Math.max(
    1,
    Math.floor((Date.now() - date.getTime()) / 1000),
  )

  if (seconds < 60) return 'À l\'instant'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} j`

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

function MediaVideoPreview({
  media,
  onPress,
}: {
  media: NewsPostMedia
  onPress: () => void
}) {
  const thumbnail = getFeedImageUrl(
    media.thumbnailUrl ?? media.url,
    720,
  )

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Lire la vidéo"
      style={styles.videoPreview}
    >
      <Image
        source={
          thumbnail
            ? { uri: thumbnail }
            : undefined
        }
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={300}
      />

      <View style={styles.videoOverlay}>
        <View style={styles.playButton}>
          <Ionicons
            name="play"
            size={28}
            color="#F5F5F5"
          />
        </View>
      </View>
    </Pressable>
  )
}

function MediaGrid({ media, onImagePress, onVideoPress }: { media: NewsPostMedia[]; onImagePress?: (index: number) => void; onVideoPress?: () => void }) {
  const { width } = useWindowDimensions()
  const availableWidth = Math.min(width, 720)

  if (media.length === 0) {
  return null
}

if (media[0].type === 'video') {
  return (
    <MediaVideoPreview
      media={media[0]}
      onPress={onVideoPress ?? (() => {})}
    />
  )
}

  if (media.length === 1) {
    return (
      <Pressable onPress={() => onImagePress?.(0)}>
        <Image
          source={{
            uri: getFeedImageUrl(
              media[0].thumbnailUrl ?? media[0].url,
              720,
            ),
          }}
          style={{
            width: availableWidth,
            height: Math.min(availableWidth * 1.05, 620),
            backgroundColor: '#111',
          }}
          contentFit="cover"
          transition={300}
        />
      </Pressable>
    )
  }

  const visible = media.slice(0, 4)
  const gap = 2
  const cellWidth = (availableWidth - gap) / 2
  const cellHeight = Math.min(cellWidth, 280)

  return (
    <View
      style={{
        width: availableWidth,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap,
      }}
    >
      {visible.map((item, index) => {
        const remaining = media.length - 4

        return (
          <Pressable
            key={`${item.url}-${index}`}
            onPress={() => onImagePress?.(index)}
            style={{
              width: cellWidth,
              height: cellHeight,
              backgroundColor: '#111',
            }}
          >
            <Image
              source={{
                uri: getFeedImageUrl(
                  item.thumbnailUrl ?? item.url,
                  720,
                ),
              }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
            />

            {index === 3 && remaining > 0 && (
              <View style={styles.moreOverlay}>
                <Text style={styles.moreText}>+{remaining}</Text>
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

function PostCardComponent({
  post,
  currentUserId,
  onComment,
  onSave,
  onEdit,
  onDelete,
  onMore,
  onRepost,
  onPress,
}: PostCardProps) {
  const { myReaction, toggleReaction } = useReactions(post.id, currentUserId)
  const liked = post.likedBy.includes(currentUserId) || !!myReaction
  const saved = post.savedBy.includes(currentUserId)
  const isOwner = post.userId === currentUserId
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)

  const {
    reposted,
    count: repostCount,
    loading: repostLoading,
    toggle: togglePostRepost,
  } = useNewsRepost(
    post.id,
    post.repostedBy.includes(currentUserId),
    post.reposts,
  )

  const handleRepost = useCallback(async () => {
    const result = await togglePostRepost()

    if (result) {
      onRepost?.(post.id, result.reposted, result.reposts)
    }
  }, [onRepost, post.id, togglePostRepost])

  const handleSave = useCallback(async () => {
    if (!currentUserId) return
    const wasSaved = saved
    // Optimistic update
    try {
      await runTransaction(db, async (transaction) => {
        const postRef = doc(db, 'posts', post.id)
        const snap = await transaction.get(postRef)
        if (!snap.exists()) return
        const data = snap.data()
        const currentSavedBy: string[] = data.savedBy ?? []
        const isSaved = currentSavedBy.includes(currentUserId)
        transaction.update(postRef, {
          savedBy: isSaved ? arrayRemove(currentUserId) : arrayUnion(currentUserId),
          saves: increment(isSaved ? -1 : 1),
        })
      })
    } catch (error) {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        { context: 'PostCard.handleSave', postId: post.id },
      )
    }
  }, [post.id, currentUserId, saved])

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: post.text
          ? `${post.text}\n\nPublication Mbolo`
          : 'Découvre cette publication sur Mbolo',
      })
    } catch (error) {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        { context: 'PostCard.handleShare', postId: post.id },
      )
    }
  }, [post.id, post.text])

  return (
    <Pressable
      style={styles.card}
      onPress={onPress ? () => onPress(post) : undefined}
    >
      <View style={styles.header}>
        {post.userPhotoURL ? (
          <Image
            source={{ uri: getAvatarImageUrl(post.userPhotoURL, 120) }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={22} color="#8A8A8A" />
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.userName} numberOfLines={1}>
            {post.userName}
            {post.mood ? <Text style={{ fontWeight: '400', color: '#B8B8B8' }}>{`  se sent ${post.mood.emoji} ${post.mood.label}`}</Text> : null}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.meta}>{timeAgo(post.createdAt)}</Text>
            <Text style={styles.dot}>·</Text>
            <Ionicons
              name={
                post.visibility === 'public'
                  ? 'earth'
                  : post.visibility === 'followers'
                    ? 'people'
                    : 'lock-closed'
              }
              size={12}
              color="#9B9B9B"
            />
          </View>
        </View>

        <Pressable
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={
            isOwner
              ? 'Options de ma publication'
              : 'Options de la publication'
          }
          style={styles.moreButton}
          onPress={() => {
            if (isOwner) {
              Alert.alert('Publication', undefined, [
                {
                  text: 'Modifier',
                  onPress: () => onEdit(post),
                },
                {
                  text: 'Supprimer',
                  style: 'destructive',
                  onPress: () => onDelete(post),
                },
                {
                  text: 'Annuler',
                  style: 'cancel',
                },
              ])
            } else {
              onMore(post)
            }
          }}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={22}
            color="#B0B0B0"
          />
        </Pressable>
      </View>

      {!!post.text && post.background && post.background !== 'none' && post.media.length === 0 ? (
        <LinearGradient
          colors={(POST_BACKGROUNDS.find((b) => b.id === post.background) ?? POST_BACKGROUNDS[0]).colors}
          style={styles.bgTextWrap}
        >
          <Text style={styles.bgText}>{post.text}</Text>
        </LinearGradient>
      ) : !!post.text ? (
        <View>
          <RichPostText
            text={expanded ? post.text : post.text.slice(0, 280)}
            style={[styles.bodyText, !expanded && post.text.length > 280 && { maxHeight: 105 }]}
          />
          {post.text.length > 280 && (
            <Pressable onPress={() => setExpanded(!expanded)}>
              <Text style={{ color: '#888', fontSize: 14, paddingHorizontal: 14, paddingBottom: 4 }}>
                {expanded ? 'Voir moins' : 'Voir plus'}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {post.location && (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={colors.primary} />
          <Text style={styles.locationText}>{post.location.name}</Text>
        </View>
      )}

      <MediaGrid
        media={post.media}
        onImagePress={(index) => setGalleryIndex(index)}
        onVideoPress={onPress ? () => onPress(post) : undefined}
      />

      {post.poll && <PollView poll={post.poll} postId={post.id} currentUserId={currentUserId} />}

      {(post.reactionCounts?.total ?? post.likes) > 0 || post.comments > 0 || post.shares > 0 || repostCount > 0 ? (
        <View style={styles.stats}>
          <View style={styles.likeStat}>
            {/* Top 3 reaction emojis */}
            {post.reactionCounts && post.reactionCounts.total > 0 ? (
              <View style={styles.reactionEmojis}>
                {(Object.entries(post.reactionCounts)
                  .filter(([k, v]) => k !== 'total' && v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3) as [string, number][])
                  .map(([type]) => (
                    <Text key={type} style={styles.reactionEmoji}>
                      {REACTION_EMOJI[type as PostReactionType] ?? '👍'}
                    </Text>
                  ))}
              </View>
            ) : (
              <View style={styles.likeCircle}>
                <Ionicons name="thumbs-up" size={11} color="#fff" />
              </View>
            )}
            <Text style={styles.statText}>{post.reactionCounts?.total ?? post.likes}</Text>
          </View>

          <View style={styles.statsRight}>
            {repostCount > 0 && (
              <Text style={styles.statText}>
                {repostCount} repost{repostCount > 1 ? 's' : ''}
              </Text>
            )}

            {post.comments > 0 && (
              <Text style={styles.statText}>
                {post.comments} commentaire{post.comments > 1 ? 's' : ''}
              </Text>
            )}

            {post.shares > 0 && (
              <Text style={styles.statText}>
                {post.shares} partage{post.shares > 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            myReaction
              ? 'Modifier ma réaction'
              : "J'aime cette publication"
          }
          onPress={() => void toggleReaction()}
          onLongPress={() => setShowReactionPicker(true)}
          style={[styles.action, !!myReaction && styles.actionActive]}
        >
          {myReaction ? (
            <Text style={{ fontSize: 20 }}>{REACTION_EMOJI[myReaction]}</Text>
          ) : (
            <Ionicons
              name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={21}
              color={liked ? colors.primary : '#B5B5B5'}
            />
          )}
          <Text
            style={[
              styles.actionText,
              (liked || myReaction) && { color: colors.primary },
            ]}
          >
            {myReaction ? (myReaction === 'like' ? "J'aime" : myReaction === 'love' ? 'Adore' : myReaction === 'fire' ? 'Feu' : 'Bravo') : "J'aime"}
          </Text>
        </Pressable>

        <ReactionPicker
          visible={showReactionPicker}
          onSelect={(type) => toggleReaction(type)}
          onClose={() => setShowReactionPicker(false)}
        />

        {post.commentsEnabled && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Commenter la publication"
            onPress={() => onComment(post)}
            style={styles.action}
          >
            <Ionicons
              name="chatbubble-outline"
              size={21}
              color="#B5B5B5"
            />
            <Text style={styles.actionText}>Commenter</Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reposted ? 'Retirer le repost' : 'Reposter la publication'}
          onPress={() => void handleRepost()}
          disabled={repostLoading}
          style={[styles.action, reposted && styles.actionActive]}
        >
          <Ionicons
            name="repeat-outline"
            size={21}
            color={reposted ? colors.primary : '#B5B5B5'}
          />
          <Text
            style={[
              styles.actionText,
              reposted && { color: colors.primary },
            ]}
          >
            Reposter
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            saved
              ? 'Retirer des enregistrements'
              : 'Enregistrer la publication'
          }
          onPress={() => void handleSave()}
          style={styles.action}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={21}
            color={saved ? colors.primary : '#B5B5B5'}
          />
          <Text
            style={[
              styles.actionText,
              saved && { color: colors.primary },
            ]}
          >
            Enregistrer
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Partager la publication"
          onPress={() => void handleShare()}
          style={styles.action}
        >
          <Ionicons
            name="arrow-redo-outline"
            size={22}
            color="#B5B5B5"
          />
          <Text style={styles.actionText}>Partager</Text>
        </Pressable>
      </View>

      <ImageGalleryModal
        media={post.media}
        initialIndex={galleryIndex ?? 0}
        visible={galleryIndex !== null}
        onClose={() => setGalleryIndex(null)}
      />
    </Pressable>
  )
}

export const PostCard = memo(PostCardComponent)

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111214',
    borderBottomWidth: 8,
    borderBottomColor: '#08090A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarFallback: {
    backgroundColor: '#25272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    color: '#F5F5F5',
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    color: '#9B9B9B',
    fontSize: 12,
  },
  dot: {
    color: '#9B9B9B',
    fontSize: 12,
  },
  moreButton: {
    padding: 6,
  },
  bodyText: {
    color: '#F0F0F0',
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  videoPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  playButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(8, 9, 10, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },

  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 9, 10, 0.18)',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  stats: {
    minHeight: 42,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  likeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmojis: {
    flexDirection: 'row',
    marginRight: 2,
  },
  reactionEmoji: {
    fontSize: 14,
    marginLeft: -4,
  },
  statsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  statText: {
    color: '#A8A8A8',
    fontSize: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
    backgroundColor: '#303236',
  },
  actions: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  action: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionActive: {
    backgroundColor: 'rgba(0,200,83,0.1)',
    borderRadius: 20,
  },
  actionText: {
    color: '#B5B5B5',
    fontSize: 11,
    fontWeight: '600',
  },
  bgTextWrap: { minHeight: 200, marginHorizontal: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  bgText: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', lineHeight: 32 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingBottom: 10 },
  locationText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
})
