import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Timestamp } from 'firebase/firestore'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { Avatar } from '@/components/ui/Avatar'
import { colors } from '@/lib/theme'

interface ConversationItemProps {
  pseudo: string
  nom?: string
  photoURL?: string
  lastMessage?: string
  lastMessageAt?: Timestamp | Date | null
  unread: boolean
  pinned?: boolean
  muted?: boolean
  online?: boolean
  typing?: boolean
  deliveryStatus?: 'sent' | 'delivered' | 'read'
  draft?: string
  selectable?: boolean
  selected?: boolean
  onSelectToggle?: () => void
  onPress: () => void
  onLongPress?: () => void
  onSwipeDelete?: () => void
  swipeIcon?: string
  swipeLabel?: string
  swipeColor?: string
}

export function ConversationItem({
  pseudo, nom, photoURL, lastMessage, lastMessageAt, unread,
  pinned, muted, online, typing, deliveryStatus, draft,
  selectable, selected, onSelectToggle,
  onPress, onLongPress, onSwipeDelete,
  swipeIcon = 'archive-outline', swipeLabel = 'Archiver', swipeColor = '#444',
}: ConversationItemProps) {
  const timeStr = lastMessageAt
    ? formatRelativeTime(toDate(lastMessageAt)!)
    : ''

  const renderRightActions = () => {
    if (!onSwipeDelete || selectable) return null
    return (
      <TouchableOpacity
        onPress={onSwipeDelete}
        style={{
          backgroundColor: swipeColor, justifyContent: 'center', alignItems: 'center',
          width: 80, marginVertical: 0,
        }}
      >
        <Ionicons name={swipeIcon as any} size={22} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 12, marginTop: 2 }}>{swipeLabel}</Text>
      </TouchableOpacity>
    )
  }

  const deliveryIcon = deliveryStatus === 'read'
    ? { name: 'checkmark-done' as const, color: '#34b7f1' }
    : deliveryStatus === 'delivered'
      ? { name: 'checkmark-done' as const, color: '#888' }
      : deliveryStatus === 'sent'
        ? { name: 'checkmark' as const, color: '#888' }
        : null

  const content = (
    <TouchableOpacity
      onPress={selectable ? onSelectToggle : onPress}
      onLongPress={selectable ? undefined : onLongPress}
      delayLongPress={500}
      activeOpacity={selectable ? 0.5 : 0.2}
      style={{
        flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
        borderBottomWidth: 0.5, borderBottomColor: '#222',
        backgroundColor: selectable && selected ? 'rgba(255,255,255,0.05)' : 'transparent',
      }}
    >
      {selectable && (
        <View style={{ width: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
          <View
            style={{
              width: 22, height: 22, borderRadius: 11, borderWidth: 2,
              borderColor: selected ? colors.primary : '#555',
              backgroundColor: selected ? colors.primary : 'transparent',
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </View>
      )}
      <View style={{ position: 'relative' }}>
        <Avatar uri={photoURL} name={nom || pseudo} size={52} />
        {online && (
          <View style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#34b7f1', borderWidth: 2, borderColor: '#000' }} />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 4 }}>
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
              {nom || pseudo}
            </Text>
            {pinned && <Ionicons name="flag" size={14} color="#888" />}
            {muted && <Ionicons name="notifications-off" size={12} color="#888" />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {timeStr ? (
              <Text style={{ color: '#888', fontSize: 12 }}>{timeStr}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
          {typing ? (
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: '#34b7f1', fontStyle: 'italic' }}>
              Écrit...
            </Text>
          ) : draft ? (
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: '#e8b800', fontStyle: 'italic' }}>
              Brouillon: {draft}
            </Text>
          ) : lastMessage ? (
            <Text
              numberOfLines={1}
              style={{
                flex: 1, fontSize: 14, color: unread ? colors.white : '#888',
                fontWeight: unread ? '600' : '400',
              }}
            >
              {lastMessage}
            </Text>
          ) : null}
          {deliveryIcon && (
            <Ionicons name={deliveryIcon.name} size={14} color={deliveryIcon.color} style={{ marginLeft: 4 }} />
          )}
          {unread && !selectable && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 4 }} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  )

  if (selectable) return content

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      {content}
    </Swipeable>
  )
}

function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  return value
}

function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'maintenant'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
