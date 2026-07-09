/* StoryViewer — lecteur plein écran façon WhatsApp.
   - Barres de progression segmentées (une par story du groupe courant).
   - Image : 5s. Vidéo : durée réelle (expo-video), progress piloté par timeUpdate.
   - Appui long = pause. Tap gauche/droite = prev/next. Swipe down = close.
   - Enchaîne automatiquement les groupes (users) suivants.
   - Marque chaque story comme vue à l'affichage. */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, Image, Dimensions, Pressable, Animated, StyleSheet, PanResponder,
} from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import type { StoryGroup } from '../hooks/useStoriesFeed'
import type { Story } from '../../../hooks/useStories'

const { width: W, height: H } = Dimensions.get('window')
const IMAGE_DURATION = 5000

interface StoryViewerProps {
  groups: StoryGroup[]
  initialGroupIndex: number
  onClose: () => void
  onViewed: (storyId: string) => void
}

export default function StoryViewer({ groups, initialGroupIndex, onClose, onViewed }: StoryViewerProps) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex)
  const [storyIdx, setStoryIdx] = useState(groups[initialGroupIndex]?.firstUnseenIndex ?? 0)
  const [paused, setPaused] = useState(false)

  const group = groups[groupIdx]
  const story: Story | undefined = group?.stories[storyIdx]
  const isVideo = story?.mediaType === 'video'

  const progress = useRef(new Animated.Value(0)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)
  const translateY = useRef(new Animated.Value(0)).current

  const player = useVideoPlayer(isVideo ? story?.mediaUrl ?? null : null, (p) => {
    p.loop = false
    p.timeUpdateEventInterval = 0.1
  })

  // Navigation ----------------------------------------------------------------
  const goNextStory = useCallback(() => {
    progress.stopAnimation()
    progress.setValue(0)
    if (!group) return
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((i) => i + 1)
    } else if (groupIdx < groups.length - 1) {
      const ng = groups[groupIdx + 1]
      setGroupIdx((g) => g + 1)
      setStoryIdx(ng.firstUnseenIndex)
    } else {
      onClose()
    }
  }, [group, storyIdx, groupIdx, groups, onClose, progress])

  const goPrevStory = useCallback(() => {
    progress.stopAnimation()
    progress.setValue(0)
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1)
    } else if (groupIdx > 0) {
      const pg = groups[groupIdx - 1]
      setGroupIdx((g) => g - 1)
      setStoryIdx(pg.stories.length - 1)
    }
  }, [storyIdx, groupIdx, groups, progress])

  // Marque comme vue + (re)lance la progression à chaque story affichée -------
  useEffect(() => {
    if (!story) return
    onViewed(story.id)
    progress.setValue(0)

    if (isVideo) {
      try { player.currentTime = 0; player.play() } catch {}
      return
    }

    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: IMAGE_DURATION,
      useNativeDriver: false,
    })
    animRef.current = anim
    anim.start(({ finished }) => { if (finished) goNextStory() })
    return () => anim.stop()
  }, [story?.id, isVideo])

  // Progression vidéo pilotée par le player ----------------------------------
  useEffect(() => {
    if (!isVideo || !player) return
    // @ts-expect-error: addListener existe sur le native SharedObject mais pas dans le type TS
    const subTime = player.addListener('timeUpdate', ({ currentTime }: { currentTime: number }) => {
      const dur = player.duration
      if (dur && dur > 0) progress.setValue(Math.min(1, currentTime / dur))
    })
    // @ts-expect-error: addListener existe sur le native SharedObject mais pas dans le type TS
    const subEnd = player.addListener('playToEnd', () => goNextStory())
    return () => { subTime.remove(); subEnd.remove() }
  }, [isVideo, player, goNextStory, progress])

  // Pause / reprise (appui long) ----------------------------------------------
  const setPausedState = useCallback((p: boolean) => {
    setPaused(p)
    if (isVideo) {
      try { p ? player.pause() : player.play() } catch {}
    } else {
      if (p) {
        progress.stopAnimation((v) => { progress.setValue(v) })
      } else {
        progress.stopAnimation((v) => {
          Animated.timing(progress, {
            toValue: 1,
            duration: IMAGE_DURATION * (1 - v),
            useNativeDriver: false,
          }).start(({ finished }) => { if (finished) goNextStory() })
        })
      }
    }
  }, [isVideo, player, progress, goNextStory])

  // Swipe down pour fermer ----------------------------------------------------
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy) },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120) {
          onClose()
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start()
        }
      },
    }),
  ).current

  if (!group || !story) return null

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]} {...pan.panHandlers}>
      {/* Barres segmentées */}
      <View style={styles.bars}>
        {group.stories.map((_, i) => (
          <View key={i} style={styles.barBg}>
            <Animated.View
              style={{
                height: '100%',
                backgroundColor: '#fff',
                borderRadius: 2,
                width:
                  i < storyIdx ? '100%'
                  : i > storyIdx ? '0%'
                  : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }}
            />
          </View>
        ))}
      </View>

      {/* Header user */}
      <View style={styles.header}>
        {group.avatarUrl ? (
          <Image source={{ uri: group.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: '#333' }]} />
        )}
        <Text style={styles.username}>{group.username}</Text>
        <Pressable onPress={onClose} style={{ marginLeft: 'auto', padding: 8 }}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
      </View>

      {/* Média */}
      <View style={StyleSheet.absoluteFill}>
        {isVideo ? (
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        ) : (
          <Image source={{ uri: story.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        )}
      </View>

      {/* Caption */}
      {story.caption ? (
        <View style={styles.caption}>
          <Text style={styles.captionText}>{story.caption}</Text>
        </View>
      ) : null}

      {/* Zones tactiles : gauche = prev, droite = next, long press = pause */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.tapRow}>
          <Pressable
            style={{ flex: 1 }}
            onPress={goPrevStory}
            onLongPress={() => setPausedState(true)}
            onPressOut={() => paused && setPausedState(false)}
            delayLongPress={200}
          />
          <Pressable
            style={{ flex: 2 }}
            onPress={goNextStory}
            onLongPress={() => setPausedState(true)}
            onPressOut={() => paused && setPausedState(false)}
            delayLongPress={200}
          />
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, width: W, height: H, backgroundColor: '#000' },
  bars: { position: 'absolute', top: 50, left: 8, right: 8, flexDirection: 'row', gap: 4, zIndex: 10 },
  barBg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  header: { position: 'absolute', top: 62, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  username: { color: '#fff', fontWeight: '600', fontSize: 15 },
  caption: { position: 'absolute', bottom: 80, left: 20, right: 20, zIndex: 10 },
  captionText: { color: '#fff', fontSize: 16, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
  tapRow: { flex: 1, flexDirection: 'row' },
})
