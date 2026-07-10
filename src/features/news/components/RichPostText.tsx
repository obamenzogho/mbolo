import { useCallback } from 'react'
import { Text, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/lib/theme'

interface Props {
  text: string
  style?: any
}

const REGEX = /(#[\w\u00C0-\u024F]+|@[\w\u00C0-\u024F]+)/g

export default function RichPostText({ text, style }: Props) {
  const handlePress = useCallback((token: string) => {
    if (token.startsWith('#')) {
      router.push({
        pathname: '/(tabs)/explore',
        params: { search: token },
      })
    } else if (token.startsWith('@')) {
      router.push({
        pathname: '/(tabs)/explore',
        params: { search: token.slice(1) },
      })
    }
  }, [])

  const parts = text.split(REGEX)

  return (
    <Text style={[styles.base, style]} selectable>
      {parts.map((part, index) => {
        if (REGEX.test(part)) {
          REGEX.lastIndex = 0

          return (
            <Text
              key={index}
              style={styles.link}
              onPress={() => handlePress(part)}
            >
              {part}
            </Text>
          )
        }

        return part
      })}
    </Text>
  )
}

const styles = StyleSheet.create({
  base: {
    color: '#F0F0F0',
    fontSize: 15,
    lineHeight: 21,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
})
