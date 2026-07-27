import { memo } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { colors } from '@/lib/theme'
import { formatCount } from '@/hooks/useComments'
import type { PostResult, PostMediaType } from '@/services/searchService'
import { HighlightedText } from './HighlightedText'

interface VideoResultCardProps {
  video: PostResult
  onPress?: () => void
  term?: string
  grid?: boolean
}

const VIDEO_MEDIA_TYPES: PostMediaType[] = ['video', 'video_share']

export const VideoResultCard = memo(function VideoResultCard({ video, onPress, term, grid }: VideoResultCardProps) {
  const thumb = video.thumbnailUrl || video.mediaUrl
  const title = video.description || video.text || 'Vidéo'
  const isVideo = video.mediaType ? VIDEO_MEDIA_TYPES.includes(video.mediaType) : true

  if (grid) {
    return (
      <TouchableOpacity
        onPress={() => { onPress?.(); router.push({ pathname: '/post-detail', params: { postId: video.id } }) }}
        style={styles.gridCard}
        activeOpacity={0.8}
      >
        <View style={styles.gridThumb}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.gridThumbImage} resizeMode="cover" />
          ) : (
            <View style={styles.gridFallback}>
              <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={28} color="#555" />
          </View>
          )}
          {isVideo && (
            <View style={styles.playBadgeLarge}>
              <Ionicons name="play" size={14} color="#fff" />
          </View>
          )}
          <View style={styles.gridOverlay}>
            {(video.likeCount ?? 0) > 0 && (
              <View style={styles.gridStat}>
                <Ionicons name="heart" size={12} color="#fff" />
                <Text style={styles.gridStatText}>{formatCount(video.likeCount)}</Text>
            </View>
            )}
            {(video.viewCount ?? 0) > 0 && (
              <View style={styles.gridStat}>
                <Ionicons name="eye" size={12} color="#fff" />
                <Text style={styles.gridStatText}>{formatCount(video.viewCount)}</Text>
            </View>
            )}
        </View>
      </View>
        <HighlightedText
          text={title}
          term={term ?? ''}
          style={styles.gridTitle}
          numberOfLines={2}
        />
        {video.userName ? (
          <Text style={styles.gridAuthor} numberOfLines={1}>
            @{video.userName}
        </Text>
        ) : null}
    </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      onPress={() => { onPress?.(); router.push({ pathname: '/post-detail', params: { postId: video.id } }) }}
      style={styles.card}
      activeOpacity={0.7}
    >
      <View style={styles.thumb}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={22} color="#888" />
        )}
        {isVideo && (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={10} color="#fff" />
        </View>
        )}
    </View>
      <View style={styles.info}>
        <HighlightedText
          text={title}
          term={term ?? ''}
          style={styles.title}
          numberOfLines={2}
        />
        {video.userName ? (
          <Text style={styles.author} numberOfLines={1}>
            @{video.userName}
      </Text>
        ) : null}
        <View style={styles.metaRow}>
          {(video.likeCount ?? 0) > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="heart" size={11} color={colors.textSecondary} />
              <Text style={styles.meta}>{formatCount(video.likeCount)}</Text>
          </View>
          )}
          {(video.viewCount ?? 0) > 0 && (
            <View style={styles.metaItem}>
              <Ionicons name="eye" size={11} color={colors.textSecondary} />
              <Text style={styles.meta}>{formatCount(video.viewCount)}</Text>
          </View>
          )}
      </View>
    </View>
  </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  // List mode
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  author: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { color: colors.textSecondary, fontSize: 11 },

  // Grid mode
  gridCard: {
    flex: 1,
    margin: 3,
  },
  gridThumb: {
    aspectRatio: 0.8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  gridThumbImage: { width: '100%', height: '100%' },
  gridFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playBadgeLarge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    gap: 8,
  },
  gridStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridStatText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  gridTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    marginHorizontal: 2,
  },
  gridAuthor: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    marginHorizontal: 2,
  },
})
