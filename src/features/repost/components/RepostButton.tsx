import { memo, useCallback, useRef } from 'react'
import { TouchableOpacity, Text, Animated, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { captureException } from '@/lib/sentry'
import { useRepost } from '../hooks/useRepost'
import type { Video } from '@/types'

interface RepostButtonProps {
  video: Video
  size?: number
  showLabel?: boolean
  onRepost?: (reposted: boolean) => void
}

function RepostButtonComponent({ video, size = 28, showLabel = true, onRepost }: RepostButtonProps) {
  const { reposted, repostCount, toggleRepost } = useRepost({
    video,
    onSuccess: onRepost,
    onError: (e) => {
      captureException(e, { context: 'RepostButton' })
    },
  })

  const scaleAnim = useRef(new Animated.Value(1)).current

  const animateBounce = useCallback(() => {
    scaleAnim.setValue(1)
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.35,
        useNativeDriver: true,
        friction: 3,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 3,
      }),
    ]).start()
  }, [scaleAnim])

  const handlePress = useCallback(async () => {
    try {
      animateBounce()
      await toggleRepost()
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'RepostButton/handlePress' })
    }
  }, [toggleRepost, animateBounce])

  const formatCount = (count: number) => {
    if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + 'M'
    if (count >= 1_000) return (count / 1_000).toFixed(1) + 'k'
    return count
  }

  return (
    <TouchableOpacity
      style={{ alignItems: 'center', justifyContent: 'center' }}
      onPress={handlePress}
      activeOpacity={0.6}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={reposted ? 'repeat' : 'repeat-outline'}
          size={size}
          color="#FFD700"
        />
      </Animated.View>
      {showLabel && (
        <Text
          style={{
            color: '#FFD700',
            fontSize: 12,
            fontWeight: '500',
            marginTop: 4,
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 2,
          }}
        >
          {repostCount > 0 ? formatCount(repostCount) : 'Républier'}
        </Text>
      )}
    </TouchableOpacity>
  )
}

export const RepostButton = memo(RepostButtonComponent, (prev, next) => {
  if (prev.video.id !== next.video.id) return false
  if (prev.video.reposts !== next.video.reposts) return false
  if (prev.video.repostedBy !== next.video.repostedBy) return false
  return true
})
