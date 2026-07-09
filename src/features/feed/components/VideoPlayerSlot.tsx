/* VideoPlayerSlot — slot vidéo individuel.
   Rôle : affiche VideoView (via playerRegistry) OU thumbnail/firstFrame en fallback.
   Crossfade animé image → vidéo via Reanimated. Gère le chargement firstFrame depuis le cache. */

import { memo, useRef, useState, useEffect, useCallback } from 'react'
import { View, Image } from 'react-native'
import { VideoView } from 'expo-video'
import type { VideoPlayer } from 'expo-video'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'
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
  const prevVideoId = useRef(videoId)
  const fadingRef = useRef(false)

  const player = usePlayerForVideo(instanceId, videoId)

  useEffect(() => {
    if (prevVideoId.current !== videoId) {
      fadingRef.current = false
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
    if (fadingRef.current) return
    fadingRef.current = true
    console.log('[Slot:firstFrame] videoId=', videoId, 'instanceId=', instanceId)
    // crossfade 400ms — la vidéo commence à rendre sa première frame
    thumbOpacity.value = withTiming(0, { duration: 400 })
    setTimeout(() => setReady(true), 500)
  }, [thumbOpacity, videoId, instanceId])

  useEffect(() => {
    if (player) {
      console.log('[Slot:player] videoId=', videoId, 'instanceId=', instanceId, 'status=', player.status)
    }
  }, [player, videoId, instanceId])

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    opacity: thumbOpacity.value,
  }))

  const displayUri = firstFrameUri || thumbnailURL

  return (
    <View style={{ width: '100%', height: '100%' }}>
      {player ? (
        <VideoView
          key={videoId}
          player={player}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          nativeControls={false}
          onFirstFrameRender={handleFirstFrameRender}
        />
      ) : null}

      {!ready && (
        <Animated.View style={[{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }, thumbAnimatedStyle]}>
          {displayUri ? (
            <Image
              source={{ uri: displayUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#1a1a1a', '#0d0d0d']}
              style={{ width: '100%', height: '100%' }}
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
