import { useRef, useEffect, memo } from 'react'
import { View, StyleSheet } from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'

interface VideoPlayerProps {
  uri: string
  isActive: boolean
  isTabFocused: boolean
  isPageActive: boolean
  isPaused: boolean
  savedPosition: number
  onReady: () => void
  onTimeUpdate: (currentTimeMs: number, durationMs: number) => void
  onFinish: () => void
}

function VideoPlayerComponent({
  uri, isActive, isTabFocused, isPageActive, isPaused, savedPosition,
  onReady, onTimeUpdate, onFinish,
}: VideoPlayerProps) {
  const hasSeeked = useRef(false)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onTimeUpdateRef.current = onTimeUpdate
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const player = useVideoPlayer(uri, (player) => {
    player.loop = true
    player.muted = false
    player.timeUpdateEventInterval = 0.25
  })

  useEffect(() => {
    hasSeeked.current = false
  }, [uri])

  useEffect(() => {
    if (player.status === 'readyToPlay' && savedPosition > 0 && !hasSeeked.current) {
      hasSeeked.current = true
      player.currentTime = savedPosition / 1000
    }
  }, [player, savedPosition])

  useEffect(() => {
    if (!player) return
    if (isActive && isTabFocused && isPageActive && !isPaused) {
      player.play()
    } else {
      player.pause()
    }
  }, [player, isActive, isTabFocused, isPageActive, isPaused])

  useEffect(() => {
    if (!player) return

    if (player.status === 'readyToPlay') {
      onReadyRef.current()
    }

    const unsubStatusChange = player.addListener('statusChange', (newStatus) => {
      if (newStatus === 'readyToPlay') {
        onReadyRef.current()
      }
    })
    const unsubTimeUpdate = player.addListener('timeUpdate', (currentTime) => {
      if (player.duration > 0) {
        onTimeUpdateRef.current(currentTime * 1000, player.duration * 1000)
      }
    })
    const unsubPlayToEnd = player.addListener('playToEnd', () => {
      onFinishRef.current()
    })
    return () => {
      unsubStatusChange.remove()
      unsubTimeUpdate.remove()
      unsubPlayToEnd.remove()
    }
  }, [player])

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  )
}

export const VideoPlayer = memo(VideoPlayerComponent, (prev, next) => {
  if (prev.uri !== next.uri) return false
  if (prev.savedPosition !== next.savedPosition) return false
  const prevShouldPlay = prev.isActive && prev.isTabFocused && prev.isPageActive && !prev.isPaused
  const nextShouldPlay = next.isActive && next.isTabFocused && next.isPageActive && !next.isPaused
  if (prevShouldPlay !== nextShouldPlay) return false
  return true
})
