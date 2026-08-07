import { useCallback } from 'react'
import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/lib/theme'

interface Props {
  text: string
  style?: StyleProp<TextStyle>
  numberOfLines?: number
  /* Style des tokens #/@. Sert au ghost de l'éditeur de légende :
     on y passe un style SANS fontWeight pour que les métriques de texte
     collent exactement à celles du TextInput transparent (sinon le caret
     se pose sur la lettre au lieu de l'interstice). */
  linkStyle?: StyleProp<TextStyle>
  /* Réglage avancé « masquer les mentions et les hashtags » : les tokens
     restent affichés mais ne sont ni stylés ni cliquables. */
  interactive?: boolean
}

const TOKEN_PATTERN = /(#[\w\u00C0-\u024F]+|@[\w\u00C0-\u024F]+)/g

function isToken(part: string): boolean {
  return part.startsWith('#') || part.startsWith('@')
}

export default function RichPostText({ text, style, numberOfLines, linkStyle, interactive = true }: Props) {
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
    <Text style={[styles.base, style]} selectable numberOfLines={numberOfLines}>
      {parts.map((part, index) =>
        isToken(part) ? (
          <Text
            key={index}
            accessibilityRole={interactive ? 'link' : 'text'}
            style={interactive ? [styles.link, linkStyle] : undefined}
            onPress={interactive ? () => handlePress(part) : undefined}
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
