import { useCallback } from 'react'
import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/lib/theme'

interface Props {
  text: string
  style?: StyleProp<TextStyle>
}

const TOKEN_PATTERN = /(#[\w\u00C0-\u024F]+|@[\w\u00C0-\u024F]+)/g

function isToken(part: string): boolean {
  return part.startsWith('#') || part.startsWith('@')
}

export default function RichPostText({ text, style }: Props) {
  const handlePress = useCallback((token: string) => {
    if (token.startsWith('#')) {
      router.push({
        pathname: '/explore',
        params: { search: token },
      })
    } else if (token.startsWith('@')) {
      router.push({
        pathname: '/explore',
        params: { search: token.slice(1) },
      })
    }
  }, [])

  const parts = text.split(TOKEN_PATTERN)

  return (
    <Text style={[styles.base, style]} selectable>
      {parts.map((part, index) =>
        isToken(part) ? (
          <Text
            key={index}
            accessibilityRole="link"
            style={styles.link}
            onPress={() => handlePress(part)}
          >
            {part}
          </Text>
        ) : (
          part
        ),
      )}
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
