import { memo } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { colors } from '@/lib/theme'
import { formatCount } from '@/hooks/useComments'
import type { PostResult, PostMediaType } from '@/services/searchService'
import { HighlightedText } from './HighlightedText'

interface PostResultCardProps {
  post: PostResult
  onPress?: () => void
  term?: string
}

const MEDIA_TYPE_META: Record<PostMediaType, { icon: string; label: string; color: string }> = {
  text: { icon: 'document-text-outline', label: 'Texte', color: '#7B8794' },
  image: { icon: 'image-outline', label: 'Photo', color: '#4DA3FF' },
  carousel: { icon: 'images-outline', label: 'Carrousel', color: '#A86BE8' },
  video: { icon: 'videocam-outline', label: 'Vidéo', color: '#FF4D67' },
  video_share: { icon: 'share-social-outline', label: 'Partage', color: '#FFB347' },
  article: { icon: 'newspaper-outline', label: 'Article', color: '#00C853' },
}

export const PostResultCard = memo(function PostResultCard({ post, onPress, term }: PostResultCardProps) {
  const mediaType: PostMediaType = post.mediaType ?? 'text'
  const meta = MEDIA_TYPE_META[mediaType]
  const title = post.description || post.text || 'Publication'
  const thumb = post.thumbnailUrl || post.mediaUrl

  return (
    <TouchableOpacity
      onPress={() => {
        onPress?.()
        router.push({ pathname: '/post-detail', params: { postId: post.id } })
      }}
      style={styles.card}
      activeOpacity={0.7}
    >
      <View style={styles.thumbWrap}>
        {thumb && mediaType !== 'text' ? (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name={meta.icon} size={22} color={meta.color} />
         </View>
        )}
        <View style={[styles.typeBadge, { backgroundColor: meta.color + '22', borderColor: meta.color }]}>
          <Ionicons name={meta.icon} size={10} color={meta.color} />
       </View>
     </View>
      <View style={styles.info}>
        <HighlightedText
          text={title}
          term={term ?? ''}
          style={styles.title}
          numberOfLines={2}
        />
        <View style={styles.metaRow}>
          {post.userName ? (
            <View style={styles.authorRow}>
              <Ionicons name="person-circle-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.author} numberOfLines={1}>
                @{post.userName}
             </Text>
           </View>
          ) : null}
          <View style={[styles.typePill, { backgroundColor: meta.color + '15' }]}>
            <Text style={[styles.typePillText, { color: meta.color }]}>
              {meta.label}
           </Text>
         </View>
       </View>
        <View style={styles.statsRow}>
          {(post.likeCount ?? 0) > 0 ? (
            <View style={styles.stat}>
              <Ionicons name="heart" size={11} color={colors.textSecondary} />
              <Text style={styles.statText}>{formatCount(post.likeCount)}</Text>
           </View>
          ) : null}
          {(post.commentCount ?? 0) > 0 ? (
            <View style={styles.stat}>
              <Ionicons name="chatbubble" size={11} color={colors.textSecondary} />
              <Text style={styles.statText}>{formatCount(post.commentCount)}</Text>
           </View>
          ) : null}
       </View>
     </View>
   </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  thumbWrap: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#08090A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  author: { color: colors.textSecondary, fontSize: 12, flexShrink: 1 },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typePillText: { fontSize: 10, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { color: colors.textSecondary, fontSize: 11 },
})
