/* VideoPlayerSlot — slot vidéo individuel.
   Rôle : affiche VideoView (via playerRegistry) OU thumbnail/firstFrame en fallback.
   Crossfade animé image → vidéo via Reanimated. Gère le chargement firstFrame depuis le cache. */

import { memo, useRef, useState, useEffect, useCallback } from 'react'
import { View, Image, StyleSheet } from 'react-native'
import { VideoView } from 'expo-video'
import type { VideoPlayer } from 'expo-video'
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { VideoCache } from '../services/VideoCache'

type Listener = (key: string) => void
const playerRegistry = new Map<string, VideoPlayer>()
const listeners = new Set<Listener>()

export function subscribeRegistry(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setPlayerForVideo(instanceId: string, videoId: string, player: VideoPlayer) {
  const key = `${instanceId}:${videoId}`
  playerRegistry.set(key, player)
  listeners.forEach((fn) => fn(key))
}

export function removePlayerForVideo(instanceId: string, videoId: string) {
  const key = `${instanceId}:${videoId}`
  playerRegistry.delete(key)
  listeners.forEach((fn) => fn(key))
}

interface VideoPlayerSlotProps {
  videoId: string
  thumbnailURL?: string
  instanceId: string
}

export function usePlayerForVideo(instanceId: string, videoId: string): VideoPlayer | null {
  const key = `${instanceId}:${videoId}`
  const [ver, setVer] = useState(0)

  useEffect(() => {
    const unsub = subscribeRegistry((changedKey) => {
      if (changedKey === key) setVer((v) => v + 1)
    })
    return unsub
  }, [key])

  return playerRegistry.get(key) ?? null
}

function VideoPlayerSlotComponent({ videoId, thumbnailURL, instanceId }: VideoPlayerSlotProps) {
  const [ready, setReady] = useState(false)
  const [firstFrameUri, setFirstFrameUri] = useState<string | null>(null)
  const thumbOpacity = useSharedValue(1)
  const firstFrameRef = useRef(false)
  const prevVideoId = useRef(videoId)

  const player = usePlayerForVideo(instanceId, videoId)

  useEffect(() => {
    if (prevVideoId.current !== videoId) {
      firstFrameRef.current = false
      setReady(false)
      setFirstFrameUri(null)
      thumbOpacity.value = 1
      prevVideoId.current = videoId
    }
  }, [videoId])

  useEffect(() => {
    let cancelled = false
    VideoCache.get(videoId).then((entry) => {
      if (cancelled) return
      if (entry?.firstFrame) {
        setFirstFrameUri(entry.firstFrame)
      }
    })
    return () => { cancelled = true }
  }, [videoId])

  const handleFirstFrameRender = useCallback(() => {
    if (firstFrameRef.current) return
    firstFrameRef.current = true
    // Instantly hide — video is already rendering, no need to fade
    setReady(true)
    thumbOpacity.value = 0
  }, [thumbOpacity])

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    opacity: thumbOpacity.value,
  }))

  const displayUri = firstFrameUri || thumbnailURL

  return (
    <View style={StyleSheet.absoluteFill}>
      {player ? (
        <VideoView
          key={videoId}
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          onFirstFrameRender={handleFirstFrameRender}
        />
      ) : null}

      {!ready && (
        <Animated.View style={[StyleSheet.absoluteFill, thumbAnimatedStyle]}>
          {displayUri ? (
            <Image
              source={{ uri: displayUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#1a1a1a', '#0d0d0d']}
              style={StyleSheet.absoluteFill}
            >
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="videocam-outline" size={48} color="#333" />
              </View>
            </LinearGradient>
          )}
        </Animated.View>
      )}
    </View>
  )
}

export const VideoPlayerSlot = memo(VideoPlayerSlotComponent)
