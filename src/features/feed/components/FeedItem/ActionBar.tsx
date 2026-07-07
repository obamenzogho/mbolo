import { memo } from 'react'
import { View, Text, TouchableOpacity, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../../lib/theme'
import { RepostButton } from '@/features/repost/components/RepostButton'
import { ShareButton } from '@/features/share/components/ShareButton'

const fmt = (n: number) => n > 0 ? (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)) : null

interface ActionBarProps {
  liked: boolean
  saved: boolean
  likeCount: number
  saveCount: number
  commentCount: number
  likeIconScale: Animated.Value
  onLike: () => void
  onSave: () => void
  onComment: () => void
  onShare: () => void
  onMore: () => void
  onRepostToggle: (reposted: boolean) => void
  video: any
}

export const ActionBar = memo(function ActionBar({
  liked, saved, likeCount, saveCount, commentCount,
  likeIconScale, onLike, onSave, onComment, onShare, onMore, onRepostToggle, video,
}: ActionBarProps) {
  const row = (child: React.ReactNode, key: string) => (
    <View key={key} style={{ alignItems: 'center', marginBottom: 16 }}>
      {child}
    </View>
  )

  return (
    <View style={{ position: 'absolute', right: 8, bottom: 100, alignItems: 'center', zIndex: 30, elevation: 30 }} pointerEvents="auto">
      <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }} onPress={onLike}>
        <Animated.View style={{ transform: [{ scale: likeIconScale }] }}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={34} color={liked ? colors.like : colors.white} />
        </Animated.View>
        <Text style={{ color: colors.white, fontSize: 12 }}>{fmt(likeCount) ?? "J'aime"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }} onPress={onComment}>
        <Ionicons name="chatbubble-outline" size={32} color={colors.white} />
        <Text style={{ color: colors.white, fontSize: 12 }}>{fmt(commentCount) ?? 'Écrire'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }} onPress={onSave}>
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={30} color={saved ? colors.save : colors.white} />
        <Text style={{ color: colors.white, fontSize: 12 }}>{fmt(saveCount) ?? 'Sauve'}</Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <RepostButton video={video} size={30} showLabel onRepost={onRepostToggle} />
      </View>

      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <ShareButton onPress={onShare} size={30} />
      </View>

      <TouchableOpacity style={{ alignItems: 'center', marginTop: 2 }} onPress={onMore}>
        <Ionicons name="ellipsis-horizontal" size={30} color={colors.white} />
      </TouchableOpacity>
    </View>
  )
})
