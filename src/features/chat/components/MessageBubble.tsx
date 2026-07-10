import { View, Text, Pressable, Image } from 'react-native'
import { Timestamp } from 'firebase/firestore'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

interface StoryRef {
  storyId: string
  mediaUrl: string
  mediaType: 'image' | 'video'
  ownerId: string
}

interface MessageBubbleProps {
  text: string
  isMine: boolean
  createdAt?: Timestamp | Date | null
  read?: boolean
  storyRef?: StoryRef
  onLongPress?: () => void
  onPressStory?: (storyRef: StoryRef) => void
}

function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null
  if (typeof (value as any).toDate === 'function') return (value as Timestamp).toDate()
  return value as Date
}

export function MessageBubble({ text, isMine, createdAt, read, storyRef, onLongPress, onPressStory }: MessageBubbleProps) {
  const date = toDate(createdAt)
  const timeStr = date
    ? `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    : ''

  return (
    <Pressable
      onLongPress={onLongPress}
      style={{
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        marginVertical: 3,
        marginHorizontal: 12,
      }}
    >
      <View
        style={{
          backgroundColor: isMine ? colors.primary : colors.surfaceLight,
          borderRadius: 16,
          borderBottomRightRadius: isMine ? 4 : 16,
          borderBottomLeftRadius: isMine ? 16 : 4,
          padding: 4,
          overflow: 'hidden',
        }}
      >
        {/* Aperçu de la story (reply to story) */}
        {storyRef ? (
          <Pressable
            onPress={() => onPressStory?.(storyRef)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'rgba(0,0,0,0.25)',
              borderRadius: 12,
              padding: 6,
              marginBottom: 4,
            }}
          >
            {/* Barre verticale style "citation" */}
            <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' }} />
            <View style={{ width: 40, height: 54, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
              {storyRef.mediaType === 'video' ? (
                <Ionicons name="play-circle" size={24} color="#fff" />
              ) : (
                <Image source={{ uri: storyRef.mediaUrl }} style={{ width: 40, height: 54 }} resizeMode="cover" />
              )}
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, flex: 1 }} numberOfLines={2}>
              {isMine ? 'Vous avez répondu à une story' : 'A répondu à votre story'}
            </Text>
          </Pressable>
        ) : null}

        <View style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: isMine ? '#fff' : colors.text, fontSize: 15 }}>
            {text}
          </Text>
          {timeStr ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 }}>
              <Text style={{ color: isMine ? 'rgba(255,255,255,0.7)' : colors.textSecondary, fontSize: 11 }}>
                {timeStr}
              </Text>
              {isMine && (
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                  {read ? 'Vu' : 'Envoyé'}
                </Text>
              )}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}