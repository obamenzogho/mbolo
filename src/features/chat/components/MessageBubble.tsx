import { View, Text, Pressable, Image, StyleSheet } from 'react-native'
import { Timestamp } from 'firebase/firestore'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

export interface StoryReplyReference {
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
  storyRef?: StoryReplyReference
  onLongPress?: () => void
  onPressStory?: (story: StoryReplyReference) => void
}

function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null
  if (typeof (value as any).toDate === 'function') {
    return (value as Timestamp).toDate()
  }
  return value as Date
}

export function MessageBubble({
  text,
  isMine,
  createdAt,
  read,
  storyRef,
  onLongPress,
  onPressStory,
}: MessageBubbleProps) {
  const date = toDate(createdAt)
  const time = date
    ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : ''

  return (
    <Pressable
      onLongPress={onLongPress}
      style={[
        styles.wrapper,
        { alignSelf: isMine ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isMine ? colors.primary : colors.surfaceLight,
            borderBottomRightRadius: isMine ? 4 : 16,
            borderBottomLeftRadius: isMine ? 16 : 4,
          },
        ]}
      >
        {storyRef && (
          <Pressable
            onPress={() => onPressStory?.(storyRef)}
            style={styles.storyPreview}
          >
            <View style={styles.quoteBar} />

            <View style={styles.storyMedia}>
              {storyRef.mediaType === 'image' ? (
                <Image
                  source={{ uri: storyRef.mediaUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons name="videocam" size={20} color="#fff" />
                  <Ionicons
                    name="play-circle"
                    size={28}
                    color="#fff"
                    style={styles.playIcon}
                  />
                </>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.storyLabel}>
                {isMine
                  ? 'Vous avez répondu à une story'
                  : 'Réponse à votre story'}
              </Text>
              <Text style={styles.storyHint} numberOfLines={1}>
                Appuyer pour voir
              </Text>
            </View>
          </Pressable>
        )}

        <Text style={[styles.message, { color: isMine ? '#fff' : colors.text }]}>
          {text}
        </Text>

        {!!time && (
          <View style={styles.metadata}>
            <Text style={styles.time}>{time}</Text>
            {isMine && (
              <Text style={styles.time}>{read ? 'Vu' : 'Envoyé'}</Text>
            )}
          </View>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: '82%',
    marginHorizontal: 12,
    marginVertical: 3,
  },
  bubble: {
    padding: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  storyPreview: {
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    marginBottom: 5,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  quoteBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  storyMedia: {
    width: 42,
    height: 54,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    position: 'absolute',
  },
  storyLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  storyHint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    marginTop: 2,
  },
  message: {
    paddingHorizontal: 7,
    paddingTop: 4,
    fontSize: 15,
    lineHeight: 20,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 5,
    paddingHorizontal: 7,
    paddingBottom: 2,
    marginTop: 2,
  },
  time: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
  },
})
