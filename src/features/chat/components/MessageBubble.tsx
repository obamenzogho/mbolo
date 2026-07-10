import { View, Text, Image, Pressable } from 'react-native'
import { Timestamp } from 'firebase/firestore'
import { colors } from '@/lib/theme'
import type { StoryRef } from '@/types'

interface MessageBubbleProps {
  text: string
  isMine: boolean
  createdAt?: Timestamp | Date | null
  read?: boolean
  type?: string
  storyRef?: StoryRef | null
  onLongPress?: () => void
}

function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null
  if (typeof (value as any).toDate === 'function') return (value as Timestamp).toDate()
  return value as Date
}

export function MessageBubble({ text, isMine, createdAt, read, type, storyRef, onLongPress }: MessageBubbleProps) {
  const date = toDate(createdAt)
  const timeStr = date
    ? `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    : ''

  const isStoryReply = type === 'story_reply'

  return (
    <View style={{
      alignItems: isMine ? 'flex-end' : 'flex-start',
      marginVertical: 4,
      paddingHorizontal: 16,
    }}>
      <Pressable onLongPress={onLongPress} style={{
        maxWidth: '78%',
        backgroundColor: isMine ? '#262626' : '#007AFF',
        borderRadius: 18,
        borderBottomRightRadius: isMine ? 4 : 18,
        borderBottomLeftRadius: isMine ? 18 : 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        overflow: 'hidden',
      }}>
        {isStoryReply && storyRef ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 }}>
            <Image
              source={{ uri: storyRef.mediaUrl }}
              style={{ width: 44, height: 70, borderRadius: 8, backgroundColor: '#111' }}
              resizeMode="cover"
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: isMine ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.65)', fontSize: 11, marginBottom: 2 }}>
                Story
              </Text>
              <Text style={{ color: colors.white, fontSize: 15, lineHeight: 20 }}>
                {text}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={{ color: colors.white, fontSize: 16, lineHeight: 22 }}>
            {text}
          </Text>
        )}
        {timeStr ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
            <Text style={{ color: isMine ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.65)', fontSize: 12 }}>
              {timeStr}
            </Text>
            {isMine && (
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginLeft: 6 }}>
                {read ? 'Vu' : 'Envoyé'}
              </Text>
            )}
          </View>
        ) : null}
      </Pressable>
    </View>
  )
}