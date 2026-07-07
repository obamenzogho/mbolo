import { memo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { Video } from '@/types'

interface CommentPreviewProps {
  item: Video
  onPressComment?: (videoId: string) => void
}

export const CommentPreview = memo(function CommentPreview({ item, onPressComment }: CommentPreviewProps) {
  const previews = item.previewComments ?? []
  if (previews.length === 0) return null

  const totalComments = item.comments ?? 0
  const hasMore = totalComments > previews.length

  return (
    <View style={{ marginTop: 8 }}>
      {previews.slice(0, 2).map((pc, i) => (
        <Text key={i} style={styles.line} numberOfLines={1}>
          <Text style={styles.author}>{pc.authorName}</Text>
          <Text style={styles.text}>{' '}{pc.text}</Text>
        </Text>
      ))}

      {hasMore && onPressComment && (
        <TouchableOpacity onPress={() => onPressComment(item.id)}>
          <Text style={styles.more}>
            Voir les {totalComments} commentaire{totalComments > 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  line: { fontSize: 13, marginBottom: 2 },
  author: { color: '#FFF', fontWeight: '700' },
  text: { color: 'rgba(255,255,255,0.9)' },
  more: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 },
})
