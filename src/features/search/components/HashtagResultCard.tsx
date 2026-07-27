import { memo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { colors } from '@/lib/theme'
import { formatCount } from '@/hooks/useComments'
import { HighlightedText } from './HighlightedText'

interface HashtagResultCardProps {
  tag: string
  videoCount: number
  onPress?: () => void
  term?: string
}

export const HashtagResultCard = memo(function HashtagResultCard({ tag, videoCount, onPress, term }: HashtagResultCardProps) {
  return (
    <TouchableOpacity
      onPress={() => { onPress?.(); router.push({ pathname: '/hashtag/[tag]', params: { tag } }) }}
      style={styles.card}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="pricetag" size={22} color={colors.primary} />
     </View>
      <View style={styles.info}>
        <HighlightedText
          text={`#${tag}`}
          term={term ?? ''}
          style={styles.tag}
          numberOfLines={1}
        />
        <Text style={styles.count}>
          {formatCount(videoCount)} publication{videoCount > 1 ? 's' : ''}
       </Text>
     </View>
      <View style={styles.trendBadge}>
        <Ionicons name="trending-up" size={12} color={colors.primary} />
     </View>
   </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(0,200,83,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  tag: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  count: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  trendBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,200,83,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
