import { memo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n))

interface StatItem {
  key: string
  icon: keyof typeof Ionicons.glyphMap
  value: number
  label: string
  onPress?: () => void
}

interface StatsCardsProps {
  videos: number
  followers: number
  following: number
  onPressVideos?: () => void
  onPressFollowers?: () => void
  onPressFollowing?: () => void
}

export const StatsCards = memo(function StatsCards({
  videos, followers, following,
  onPressVideos, onPressFollowers, onPressFollowing,
}: StatsCardsProps) {
  const stats: StatItem[] = [
    { key: 'videos', icon: 'play-circle-outline', value: videos, label: 'Vidéos', onPress: onPressVideos },
    { key: 'followers', icon: 'people-outline', value: followers, label: 'Abonnés', onPress: onPressFollowers },
    { key: 'following', icon: 'person-add-outline', value: following, label: 'Abonnements', onPress: onPressFollowing },
  ]

  return (
    <View style={styles.row}>
      {stats.map((s) => (
        <TouchableOpacity
          key={s.key}
          onPress={s.onPress}
          activeOpacity={0.7}
          style={styles.card}
        >
          <Ionicons name={s.icon} size={18} color={colors.secondary} style={{ marginBottom: 4 }} />
          <Text style={styles.value}>{fmt(s.value)}</Text>
          <Text style={styles.label} numberOfLines={1}>{s.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
})
