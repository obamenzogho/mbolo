import { memo } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface RepostedByBannerProps {
  repostedBy: string[]
  currentUserId: string
  reposterName?: string
  reposterId: string
}

function RepostedByBannerComponent({
  repostedBy,
  currentUserId,
  reposterName,
  reposterId,
}: RepostedByBannerProps) {
  const insets = useSafeAreaInsets()
  if (!repostedBy?.length || !reposterName || reposterId === currentUserId) return null

  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: '/user/[userId]',
          params: { userId: reposterId },
        })
      }
      activeOpacity={0.7}
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.45)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        zIndex: 10,
      }}
    >
      <Ionicons name="repeat" size={12} color="#00C853" />
      <Text
        style={{
          color: '#FFF',
          fontSize: 12,
          fontWeight: '500',
        }}
        numberOfLines={1}
      >
        Republié par <Text style={{ fontWeight: '700' }}>@{reposterName}</Text>
      </Text>
    </TouchableOpacity>
  )
}

export const RepostedByBanner = memo(RepostedByBannerComponent, (prev, next) => {
  if (prev.repostedBy !== next.repostedBy) return false
  if (prev.reposterName !== next.reposterName) return false
  if (prev.reposterId !== next.reposterId) return false
  return true
})
