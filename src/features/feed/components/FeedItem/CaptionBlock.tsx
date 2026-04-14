import { memo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface CaptionBlockProps {
  description?: string
}

export const CaptionBlock = memo(function CaptionBlock({ description }: CaptionBlockProps) {
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
    </View>
  )
})

const styles = StyleSheet.create({
  description: { color: '#FFF', fontSize: 14, lineHeight: 19 },
})
