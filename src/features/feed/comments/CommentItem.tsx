import { memo, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { captureException } from '../../../lib/sentry'
import { FEED_DEBUG } from '../store/feedStore'
import { ReplyItem, type ReplyData } from './ReplyItem'

export interface CommentData {
  id: string
  userId: string
  videoId: string
  text: string
  likes: number
  likedBy: string[]
  replyCount?: number
  repliesData?: ReplyData[]
  authorName?: string
  authorPhoto?: string
  userName?: string
  userPhotoURL?: string
  createdAt?: unknown
}

interface CommentItemProps {
  comment: CommentData
  videoId: string
  isVideoOwner: boolean
  currentUserId?: string
  onLike: (commentId: string, liked: boolean) => void
  onDelete: (commentId: string) => void
  onReport: (commentId: string) => void
  onReply: (commentId: string, username: string) => void
  onToggleReplies: (commentId: string) => void
  onReplyLike: (commentId: string, replyId: string, liked: boolean) => void
  onReplyDelete: (commentId: string, replyId: string) => void
  repliesExpanded: boolean
  replies: ReplyData[]
  isLoadingReplies?: boolean
}

function formatTimeAgo(date: unknown): string {
  if (!date) return ''
  const d = (date as { toDate?: () => Date }).toDate ? (date as { toDate: () => Date }).toDate() : new Date(date as string | number)
  if (isNaN(d.getTime())) return ''
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'À l\'instant'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}j`
}

function CommentItemComponent({
  comment, videoId, isVideoOwner, currentUserId, onLike, onDelete, onReport, onReply,
  onToggleReplies, onReplyLike, onReplyDelete,
  repliesExpanded, replies, isLoadingReplies,
}: CommentItemProps) {
  const displayName = comment.authorName || comment.userName || 'Utilisateur'
  const photoURL = comment.authorPhoto || comment.userPhotoURL || null
  const isOwn = currentUserId === comment.userId
  const [liked, setLiked] = useState(comment.likedBy?.includes(currentUserId ?? '') ?? false)
  const [likeCount, setLikeCount] = useState(comment.likes ?? 0)

  const handleLike = useCallback(() => {
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount((p) => Math.max(0, newLiked ? p + 1 : p - 1))
    onLike(comment.id, newLiked)
  }, [liked, comment.id, onLike])

  const handleLongPress = useCallback(() => {
    const options: { text: string; onPress: () => void; style?: 'cancel' | 'destructive' }[] = []
    if (isOwn) {
      options.push({ text: 'Supprimer', onPress: () => {
        Alert.alert('Supprimer le commentaire', 'Confirmer la suppression ?', [
          { text: 'Annuler', style: 'cancel', onPress: () => {} },
          { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(comment.id) },
        ])
      }, style: 'destructive' })
      options.push({ text: 'Modifier', onPress: () => Alert.alert('Info', 'Modification bientôt disponible') })
    } else {
      options.push({ text: 'Signaler', onPress: async () => {
        onReport(comment.id)
        Alert.alert('Signalé', 'Ce commentaire a été signalé.')
      } })
    }
    if (isOwn) {
      options.push({ text: 'Épingler', onPress: () => Alert.alert('Info', 'Épinglage bientôt disponible') })
    }
    options.push({ text: 'Annuler', style: 'cancel', onPress: () => {} })
    Alert.alert('Options', undefined, options)
  }, [isOwn, comment.id, onDelete, onReport])

  return (
    <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.9}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: comment.userId } })}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.body}>
          <View style={styles.header}>
            <Text style={styles.username}>{displayName}</Text>
            <Text style={styles.timestamp}>{formatTimeAgo(comment.createdAt)}</Text>
          </View>
          <Text style={styles.text}>{comment.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity onPress={() => onReply(comment.id, displayName)}>
              <Text style={styles.actionText}>Répondre</Text>
            </TouchableOpacity>
            {(comment.replyCount ?? 0) > 0 && (
              <TouchableOpacity onPress={() => onToggleReplies(comment.id)}>
                <Text style={styles.viewReplies}>
                  {repliesExpanded
                    ? 'Masquer les réponses'
                    : `Voir ${comment.replyCount} réponse${(comment.replyCount ?? 0) > 1 ? 's' : ''}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {repliesExpanded && (
            <View style={styles.repliesContainer}>
              {replies.map((reply) => (
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                  commentId={comment.id}
                  videoId={videoId}
                  isVideoOwner={isVideoOwner}
                  currentUserId={currentUserId}
                  onLike={(replyId, liked) => onReplyLike(comment.id, replyId, liked)}
                  onDelete={(cId, rId) => onReplyDelete(cId, rId)}
                />
              ))}
              {isLoadingReplies && (
                <Text style={styles.loadingText}>Chargement…</Text>
              )}
            </View>
          )}
        </View>
        <View style={styles.likeSection}>
          <TouchableOpacity onPress={handleLike}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? '#FF2D55' : '#FFF'} />
          </TouchableOpacity>
          {likeCount > 0 && <Text style={styles.likeCount}>{likeCount}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  )
}

export const CommentItem = memo(CommentItemComponent)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  text: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  actionText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  viewReplies: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  likeSection: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
  },
  likeCount: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  repliesContainer: {
    marginTop: 4,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    paddingLeft: 46,
    paddingVertical: 4,
  },
})
