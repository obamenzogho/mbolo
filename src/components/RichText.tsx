import React from 'react'
import { Text, type TextStyle } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/lib/theme'
import { normalizeTag } from '@/lib/hashtags'

interface RichTextProps {
  text: string
  style?: TextStyle
  linkStyle?: TextStyle
}

const TOKEN_REGEX = /([#@][\p{L}\p{N}_.]+)/gu

export function RichText({ text, style, linkStyle }: RichTextProps) {
  if (!text) return null
  const parts = text.split(TOKEN_REGEX)

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('#')) {
          const tag = normalizeTag(part)
          return (
            <Text
              key={i}
              style={[{ color: colors.primary }, linkStyle]}
              onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag } })}
            >
              {part}
            </Text>
          )
        }
        if (part.startsWith('@')) {
          const pseudo = part.slice(1).toLowerCase()
          return (
            <Text
              key={i}
              style={[{ color: colors.primary }, linkStyle]}
              onPress={() => router.push({ pathname: '/u/[pseudo]', params: { pseudo } })}
            >
              {part}
            </Text>
          )
        }
        return <Text key={i}>{part}</Text>
      })}
    </Text>
  )
}
