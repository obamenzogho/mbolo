import { memo, useCallback } from 'react'
import {
  View,
  Text,
  Image,
  Pressable,
  Share,
  StyleSheet,
  useWindowDimensions,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { VideoView, useVideoPlayer } from 'expo-video'
import { colors } from '@/lib/theme'
import type { NewsPost, NewsPostMedia } from '../types'

interface PostCardProps {
  post: NewsPost
  currentUserId: string
  onLike: (postId: string) => void
  onComment: (post: NewsPost) => void
  onShare: (postId: string) => void
  onSave: (postId: string) => void
  onEdit: (post: NewsPost) => void
  onDelete: (post: NewsPost) => void
  onMore: (post: NewsPost) => void
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

function EmbeddedVideo({ media }: { media: NewsPostMedia }) {
  const player = useVideoPlayer(media.url, (instance) => {
    instance.loop = false
  })

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
      allowsFullscreen
    />
  )
}

function MediaGrid({ media }: { media: NewsPostMedia[] }) {
  const { width } = useWindowDimensions()
  const availableWidth = Math.min(width, 720)

  if (media.length === 0) return null

  if (media[0].type === 'video') {
    return <EmbeddedVideo media={media[0]} />
  }

  if (media.length === 1) {
    return (
      <Image
        source={{ uri: media[0].url }}
        style={{
          width: availableWidth,
          height: Math.min(availableWidth * 1.05, 620),
          backgroundColor: '#111',
        }}
        resizeMode="cover"
      />
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
          <View
            key={`${item.url}-${index}`}
            style={{
              width: cellWidth,
              height: cellHeight,
              backgroundColor: '#111',
            }}
          >
            <Image
              source={{ uri: item.url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />

            {index === 3 && remaining > 0 && (
              <View style={styles.moreOverlay}>
                <Text style={styles.moreText}>+{remaining}</Text>
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

function PostCardComponent({
  post,
  currentUserId,
  onLike,
  onComment,
  onShare,
  onSave,
  onEdit,
  onDelete,
  onMore,
}: PostCardProps) {
  const liked = post.likedBy.includes(currentUserId)
  const saved = post.savedBy.includes(currentUserId)
  const isOwner = post.userId === currentUserId

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: post.text
          ? `${post.text}\n\nPublication Mbolo`
          : 'Découvre cette publication sur Mbolo',
      })

      onShare(post.id)
    } catch {}
  }, [post.id, post.text, onShare])

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {post.userPhotoURL ? (
          <Image
            source={{ uri: post.userPhotoURL }}
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

      {!!post.text && (
        <Text style={styles.bodyText} selectable>
          {post.text}
        </Text>
      )}

      <MediaGrid media={post.media} />

      {(post.likes > 0 || post.comments > 0 || post.shares > 0) && (
        <View style={styles.stats}>
          <View style={styles.likeStat}>
            <View style={styles.likeCircle}>
              <Ionicons name="thumbs-up" size={11} color="#fff" />
            </View>
            <Text style={styles.statText}>{post.likes}</Text>
          </View>

          <View style={styles.statsRight}>
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
      )}

      <View style={styles.divider} />

      <View style={styles.actions}>
        <Pressable
          onPress={() => onLike(post.id)}
          style={styles.action}
        >
          <Ionicons
            name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
            size={21}
            color={liked ? colors.primary : '#B5B5B5'}
          />
          <Text
            style={[
              styles.actionText,
              liked && { color: colors.primary },
            ]}
          >
            J'aime
          </Text>
        </Pressable>

        {post.commentsEnabled && (
          <Pressable
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
          onPress={() => onSave(post.id)}
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

        <Pressable onPress={handleShare} style={styles.action}>
          <Ionicons
            name="arrow-redo-outline"
            size={22}
            color="#B5B5B5"
          />
          <Text style={styles.actionText}>Partager</Text>
        </Pressable>
      </View>
    </View>
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
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
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
  actionText: {
    color: '#B5B5B5',
    fontSize: 11,
    fontWeight: '600',
  },
})
