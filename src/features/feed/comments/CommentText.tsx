import { Text } from 'react-native'
import { router } from 'expo-router'
import { parseMentions } from './mentions'
import { colors } from '../../../lib/theme'

interface CommentTextProps {
  text: string
  mentionMap?: Record<string, string>
  style?: any
}

export function CommentText({ text, mentionMap = {}, style }: CommentTextProps) {
  const segments = parseMentions(text)
  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        if (seg.type === 'mention') {
          const uid = mentionMap[seg.value.toLowerCase()]
          return (
            <Text
              key={i}
              style={{ color: colors.secondary, fontWeight: '600' }}
              onPress={uid ? () => router.push({ pathname: '/user/[userId]', params: { userId: uid } }) : undefined}
            >
              @{seg.value}
            </Text>
          )
        }
        return <Text key={i}>{seg.value}</Text>
      })}
    </Text>
  )
}
