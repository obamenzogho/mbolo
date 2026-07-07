import { memo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'

interface CaptionBlockProps {
  description?: string
  hashtags?: string[]
}

export const CaptionBlock = memo(function CaptionBlock({ description, hashtags }: CaptionBlockProps) {
  const [showFull, setShowFull] = useState(false)

  return (
    <View style={{ marginTop: 8 }}>
      {description ? (
        <TouchableOpacity activeOpacity={0.8} onPress={() => setShowFull((p) => !p)}>
          <Text style={styles.description} numberOfLines={showFull ? undefined : 2}>
            {description}
          </Text>
        </TouchableOpacity>
      ) : null}

      {hashtags && hashtags.length > 0 ? (
        <Text style={styles.hashtags}>
          {hashtags.map((t) => (
            <Text
              key={t}
              style={styles.hashtag}
              onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag: t } })}
            >
              {'#' + t + ' '}
            </Text>
          ))}
        </Text>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  description: { color: '#FFF', fontSize: 14, lineHeight: 19 },
  hashtags: { marginTop: 4, fontSize: 14 },
  hashtag: { color: '#4FC3F7', fontWeight: '600' },
})
