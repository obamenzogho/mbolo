import { memo } from 'react'
import { Text } from 'react-native'
import { colors } from '@/lib/theme'

interface HighlightedTextProps {
  text: string
  term: string
  style?: any
  numberOfLines?: number
  highlightStyle?: any
}

export const HighlightedText = memo(function HighlightedText({
  text, term, style, numberOfLines, highlightStyle,
}: HighlightedTextProps) {
  if (!term || !term.trim()) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>
  }

  const q = term.trim().replace(/^#/, '').toLowerCase()
  const lowerText = text.toLowerCase()
  const idx = lowerText.indexOf(q)

  if (idx === -1 || q.length < 2) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>
  }

  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + q.length)
  const after = text.slice(idx + q.length)

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {before}
      <Text style={[{ color: colors.primary, fontWeight: '800' }, highlightStyle]}>
        {match}
      </Text>
      {after}
    </Text>
  )
})
