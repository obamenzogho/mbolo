import { View, Text, Pressable } from 'react-native'
import { Timestamp } from 'firebase/firestore'
import { colors } from '@/lib/theme'

interface MessageBubbleProps {
  text: string
  isMine: boolean
  createdAt?: Timestamp | Date | null
  read?: boolean
  onLongPress?: () => void
}

function toDate(value: Timestamp | Date | null | undefined): Date | null {
  if (!value) return null
  if (typeof (value as any).toDate === 'function') return (value as Timestamp).toDate()
  return value as Date
}

export function MessageBubble({ text, isMine, createdAt, read, onLongPress }: MessageBubbleProps) {
  const date = toDate(createdAt)
  const timeStr = date
    ? `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    : ''

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
      }}>
        <Text style={{ color: colors.white, fontSize: 16, lineHeight: 22 }}>
          {text}
        </Text>
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
