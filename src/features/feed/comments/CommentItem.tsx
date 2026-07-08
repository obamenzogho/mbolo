import { memo, useState, useCallback, useRef } from 'react'
import { View, Text, TouchableOpacity, Alert, Image, TextInput, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { captureException } from '../../../lib/sentry'
import { colors } from '../../../lib/theme'
import { CommentText } from './CommentText'
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
  edited?: boolean
}

interface CommentItemProps {
  comment: CommentData
  videoId: string
  isVideoOwner: boolean
  videoOwnerId?: string
  currentUserId?: string
  onLike: (commentId: string, liked: boolean) => void
  onDelete: (commentId: string) => void
  onReport: (commentId: string) => void
  onReply: (commentId: string, username: string) => void
  onToggleReplies: (commentId: string) => void
  onReplyLike: (commentId: string, replyId: string, liked: boolean) => void
  onReplyDelete: (commentId: string, replyId: string) => void
  onLoadMoreReplies?: (commentId: string) => void
  onEdit?: (commentId: string, newText: string) => void
  onPin?: (commentId: string, pinned: boolean) => void
  onHide?: (commentId: string, hidden: boolean) => void
  repliesExpanded: boolean
  replies: ReplyData[]
  hasMoreReplies?: boolean
  isLoadingMoreReplies?: boolean
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
  comment, videoId, isVideoOwner, videoOwnerId, currentUserId, onLike, onDelete, onReport, onReply,
  onToggleReplies, onReplyLike, onReplyDelete, onLoadMoreReplies, onEdit, onPin, onHide,
  repliesExpanded, replies, hasMoreReplies, isLoadingMoreReplies,
}: CommentItemProps) {
  const displayName = comment.authorName || comment.userName || 'Utilisateur'
  const photoURL = comment.authorPhoto || comment.userPhotoURL || null
  const isOwn = currentUserId === comment.userId
  const isCreator = comment.userId === videoOwnerId
  const creatorLiked = videoOwnerId ? (comment.likedBy?.includes(videoOwnerId) ?? false) : false
  const [liked, setLiked] = useState(comment.likedBy?.includes(currentUserId ?? '') ?? false)
  const [likeCount, setLikeCount] = useState(comment.likes ?? 0)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(comment.text)
  const lastTapRef = useRef(0)

  const handleLike = useCallback(() => {
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount((p) => Math.max(0, newLiked ? p + 1 : p - 1))
    onLike(comment.id, newLiked)
  }, [liked, comment.id, onLike])

  const handleDoubleTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      if (!liked) handleLike()
    }
    lastTapRef.current = now
  }, [liked, handleLike])

  const handleLongPress = useCallback(() => {
    const options: { text: string; onPress: () => void; style?: 'cancel' | 'destructive' }[] = []
    if (isOwn) {
      options.push({ text: 'Supprimer', onPress: () => {
        Alert.alert('Supprimer le commentaire', 'Confirmer la suppression ?', [
          { text: 'Annuler', style: 'cancel', onPress: () => {} },
          { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(comment.id) },
        ])
      }, style: 'destructive' })
      options.push({ text: 'Modifier', onPress: () => { setEditText(comment.text); setEditing(true) } })
    } else {
      options.push({ text: 'Signaler', onPress: async () => {
        onReport(comment.id)
        Alert.alert('Signalé', 'Ce commentaire a été signalé.')
      } })
    }
    if (isVideoOwner) {
      options.push({
        text: (comment as any).pinned ? 'Désépingler' : 'Épingler',
        onPress: () => onPin?.(comment.id, !(comment as any).pinned),
      })
      options.push({
        text: (comment as any).hidden ? 'Réafficher' : 'Masquer',
        onPress: () => onHide?.(comment.id, !(comment as any).hidden),
      })
    }
    options.push({ text: 'Annuler', style: 'cancel', onPress: () => {} })
    Alert.alert('Options', undefined, options)
  }, [isOwn, isVideoOwner, comment, onDelete, onReport, onPin, onHide])

  return (
    <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.9}>
      <View style={[styles.container, (comment as any).hidden && { opacity: 0.45 }]}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: comment.userId } })}>
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
            {isCreator && (
              <View style={{ backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 }}>
                <Text style={{ color: colors.white, fontSize: 10, fontWeight: '700' }}>Créateur</Text>
              </View>
            )}
            {(comment as any).pinned && <Ionicons name="pin" size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />}
            <Text style={styles.timestamp}>{formatTimeAgo(comment.createdAt)}</Text>
          </View>
          {editing ? (
            <View>
              <TextInput value={editText} onChangeText={setEditText} multiline autoFocus
                style={[styles.text, { backgroundColor: colors.surfaceLight, borderRadius: 8, padding: 8 }]} />
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                <TouchableOpacity onPress={() => setEditing(false)}>
                  <Text style={styles.actionText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onEdit?.(comment.id, editText); setEditing(false) }}>
                  <Text style={[styles.actionText, { color: colors.primary }]}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={handleDoubleTap} activeOpacity={1}>
              <CommentText text={comment.text} mentionMap={(comment as any).mentionMap} style={styles.text} />
            </TouchableOpacity>
          )}
          {comment.edited && !editing && <Text style={{ color: colors.textMuted, fontSize: 11 }}> (modifié)</Text>}
          {(comment as any).hidden && isVideoOwner && <Text style={{ color: colors.textMuted, fontSize: 11 }}> (masqué)</Text>}
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
              {hasMoreReplies && onLoadMoreReplies && (
                <TouchableOpacity onPress={() => onLoadMoreReplies(comment.id)} disabled={isLoadingMoreReplies}>
                  <Text style={styles.viewMoreReplies}>
                    {isLoadingMoreReplies ? 'Chargement…' : 'Voir plus de réponses'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleLike} style={styles.likeSection}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color={liked ? colors.like : 'rgba(255,255,255,0.5)'} />
          {likeCount > 0 && <Text style={styles.likeCount}>{likeCount}</Text>}
          {creatorLiked && <Ionicons name="heart" size={10} color="#FF4444" style={{ marginLeft: 4 }} />}
        </TouchableOpacity>
        {(comment as any).hidden && (
          <Text style={{ color: colors.textFaint, fontSize: 11, fontStyle: 'italic', marginTop: 4 }}>Masqué</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

export const CommentItem = memo(CommentItemComponent)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 13,
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
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
  },
  text: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 5,
  },
  actionText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
  viewReplies: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
  viewMoreReplies: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
    paddingLeft: 42,
    paddingVertical: 4,
  },
  likeSection: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
    width: 32,
  },
  likeCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  repliesContainer: {
    marginTop: 4,
  },
})
