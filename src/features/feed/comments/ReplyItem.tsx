import { memo, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { captureException } from '../../../lib/sentry'
import { colors } from '../../../lib/theme'

export interface ReplyData {
  id: string
  userId: string
  text: string
  likes: number
  likedBy: string[]
  replyToUsername?: string | null
  userName?: string
  authorName?: string
  userPhotoURL?: string
  authorPhoto?: string
  createdAt?: unknown
}

interface ReplyItemProps {
  reply: ReplyData
  commentId: string
  videoId: string
  isVideoOwner: boolean
  currentUserId?: string
  onLike: (replyId: string, liked: boolean) => void
  onDelete: (commentId: string, replyId: string) => void
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

function ReplyItemComponent({ reply, commentId, currentUserId, onLike, onDelete }: ReplyItemProps) {
  const displayName = reply.authorName || reply.userName || 'Utilisateur'
  const photoURL = reply.authorPhoto || reply.userPhotoURL || null
  const isOwn = currentUserId === reply.userId
  const [liked, setLiked] = useState(reply.likedBy?.includes(currentUserId ?? '') ?? false)
  const [likeCount, setLikeCount] = useState(reply.likes ?? 0)

  const handleLike = useCallback(() => {
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount((p) => Math.max(0, newLiked ? p + 1 : p - 1))
    onLike(reply.id, newLiked)
  }, [liked, reply.id, onLike])

  const handleLongPress = useCallback(() => {
    const options: { text: string; onPress: () => void; style?: 'cancel' | 'destructive' }[] = []
    if (isOwn) {
      options.push({ text: 'Supprimer', onPress: () => {
        Alert.alert('Supprimer la réponse', 'Confirmer la suppression ?', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(commentId, reply.id) },
        ])
      }, style: 'destructive' })
    } else {
      options.push({ text: 'Signaler', onPress: () => {
        Alert.alert('Signalé', 'Cette réponse a été signalée.')
      } })
    }
    options.push({ text: 'Annuler', style: 'cancel', onPress: () => {} })
    Alert.alert('Options', undefined, options)
  }, [isOwn, reply.id, commentId, onDelete])

  return (
    <TouchableOpacity onLongPress={handleLongPress} activeOpacity={0.8}>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: reply.userId } })}>
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
            <Text style={styles.timestamp}>{formatTimeAgo(reply.createdAt)}</Text>
          </View>
          <Text style={styles.text}>
            {reply.replyToUsername ? (
              <Text style={styles.mention}>@{reply.replyToUsername} </Text>
            ) : null}
            {reply.text}
          </Text>
        </View>
        <TouchableOpacity onPress={handleLike} style={styles.likeSection}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={12} color={liked ? colors.like : 'rgba(255,255,255,0.4)'} />
          {likeCount > 0 && <Text style={styles.likeCount}>{likeCount}</Text>}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

export const ReplyItem = memo(ReplyItemComponent)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingLeft: 42,
    paddingRight: 16,
    paddingVertical: 5,
    gap: 7,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  avatarPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  username: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  text: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 17,
    marginTop: 1,
  },
  mention: {
    color: '#00C853',
    fontWeight: '600',
  },
  likeSection: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
    width: 28,
  },
  likeCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
  },
})
