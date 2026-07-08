import { memo } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import type { Notification as NotificationType } from '../../types'

const ICON: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  like:           { name: 'heart',            color: '#FF2D55' },
  comment:        { name: 'chatbubble',       color: '#4FC3F7' },
  reply:          { name: 'arrow-undo',       color: '#4FC3F7' },
  follow:         { name: 'person-add',       color: colors.secondary },
  follow_request: { name: 'person-add',       color: colors.secondary },
  follow_accept:  { name: 'checkmark-circle', color: '#00C853' },
  repost:         { name: 'repeat',           color: '#00C853' },
  mention:        { name: 'at',               color: '#FFB300' },
  message:        { name: 'chatbubble-ellipses', color: '#4FC3F7' },
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `${Math.floor(s / 60)} min`
  if (s < 86400) return `${Math.floor(s / 3600)} h`
  if (s < 604800) return `${Math.floor(s / 86400)} j`
  return `${Math.floor(s / 604800)} sem`
}

interface Props {
  item: NotificationType
  actorName: string
  actorAvatar?: string
  videoThumb?: string
  onPress?: () => void
  onPressActor?: () => void
}

export const NotificationRow = memo(function NotificationRow({
  item, actorName, actorAvatar, videoThumb, onPress, onPressActor,
}: Props) {
  const badge = ICON[item.type] ?? { name: 'notifications', color: colors.secondary }
  const excerpt = (item as any).commentText || (item as any).excerpt

  const message = (() => {
    switch (item.type) {
      case 'like':           return 'a aimé ta vidéo'
      case 'comment':        return excerpt ? `a commenté : ${excerpt}` : 'a commenté ta vidéo'
      case 'reply':          return excerpt ? `a répondu : ${excerpt}` : 'a répondu à ton commentaire'
      case 'follow':         return 'a commencé à te suivre'
      case 'follow_request': return 'veut te suivre'
      case 'follow_accept':  return 'a accepté ta demande'
      case 'repost':         return 'a republié ta vidéo'
      case 'mention':        return excerpt ? `t'a mentionné : ${excerpt}` : "t'a mentionné"
      case 'message':        return "t'a envoyé un message"
      default:               return 'a interagi avec toi'
    }
  })()

  const createdAt: Date = (item as any).createdAt?.toDate?.() ?? new Date((item as any).createdAt ?? Date.now())
  const unread = (item as any).read === false

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.row, unread && styles.unread]}>
      {/* Avatar acteur + pastille type */}
      <TouchableOpacity onPress={onPressActor} activeOpacity={0.8} style={styles.avatarWrap}>
        {actorAvatar ? (
          <Image source={{ uri: actorAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{actorName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: badge.color }]}>
          <Ionicons name={badge.name} size={11} color="#FFF" />
        </View>
      </TouchableOpacity>

      {/* Texte */}
      <View style={{ flex: 1 }}>
        <Text style={styles.text} numberOfLines={2}>
          <Text style={styles.name}>{actorName}</Text>
          <Text style={styles.body}> {message}</Text>
        </Text>
        <Text style={styles.time}>{timeAgo(createdAt)}</Text>
      </View>

      {/* Miniature vidéo si applicable */}
      {videoThumb ? (
        <Image source={{ uri: videoThumb }} style={styles.thumb} />
      ) : null}
      {unread ? <View style={styles.dot} /> : null}
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  unread: { backgroundColor: colors.surfaceLight, borderRadius: 12, paddingHorizontal: 10 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: { backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  badge: {
    position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background,
  },
  text: { fontSize: 14, lineHeight: 19 },
  name: { color: colors.white, fontWeight: '700' },
  body: { color: 'rgba(255,255,255,0.85)' },
  time: { color: colors.textMuted ?? '#9aa', fontSize: 12, marginTop: 3 },
  thumb: { width: 42, height: 56, borderRadius: 6, backgroundColor: '#1a1a1a' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary, marginLeft: 4 },
})
