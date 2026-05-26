import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, Image, TouchableOpacity, Modal, Animated,
  Easing, Dimensions, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { ResizeMode, Video as AVVideo } from 'expo-av'
import { colors } from '@/lib/theme'
import { captureException } from '@/lib/sentry'
import OrbitLoader from '@/components/OrbitLoader'
import type { Highlight } from '@/features/highlights/services/highlightService'

const SCREEN_WIDTH = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height

interface HighlightViewerProps {
  highlight: Highlight | null
  visible: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onEdit: (highlight: Highlight) => void
  onAddMedia: (highlightId: string, currentMediaUrls: string[]) => Promise<string[]>
  profileAvatar?: string
  profilePseudo?: string
}

export function HighlightViewer({
  highlight,
  visible,
  onClose,
  onDelete,
  onEdit,
  onAddMedia,
  profileAvatar,
  profilePseudo,
}: HighlightViewerProps) {
  const [mediaIdx, setMediaIdx] = useState(0)
  const [optionsVisible, setOptionsVisible] = useState(false)
  const [mediaLoading, setMediaLoading] = useState(true)

  const progressAnim = useRef(new Animated.Value(0)).current
  const mediaOpacity = useRef(new Animated.Value(0)).current
  const mediaTranslateX = useRef(new Animated.Value(0)).current
  const viewerTranslateY = useRef(new Animated.Value(0)).current
  const viewerOpacity = useRef(new Animated.Value(1)).current

  const touchStartY = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animRef = useRef<Animated.CompositeAnimation | null>(null)
  const progressTimerStarted = useRef(false)
  const prevHighlightId = useRef<string | null>(null)

  const media = highlight?.mediaUrls && highlight.mediaUrls.length > 0
    ? highlight.mediaUrls
    : highlight?.coverUrl ? [highlight.coverUrl] : []
  const currentMedia = media[mediaIdx]

  const getOptimizedUrl = useCallback((url: string) => {
    if (!url || url.includes('.mp4') || url.includes('.mov')) return url
    return url.replace('/upload/', '/upload/w_600,h_1000,c_fill,q_auto,f_auto/')
  }, [])

  const closeViewer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    animRef.current?.stop()
    progressTimerStarted.current = false
    onClose()
    setMediaIdx(0)
    setOptionsVisible(false)
  }, [onClose])

  const startProgressTimer = useCallback(() => {
    if (!highlight || optionsVisible || progressTimerStarted.current) return
    progressTimerStarted.current = true
    progressAnim.setValue(0)
    animRef.current = Animated.timing(progressAnim, {
      toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: false,
    })
    animRef.current.start()
    timerRef.current = setTimeout(() => {
      progressTimerStarted.current = false
      if (mediaIdx < media.length - 1) {
        progressAnim.setValue(0)
        setMediaIdx(prev => prev + 1)
      } else {
        closeViewer()
      }
    }, 5000)
  }, [highlight, optionsVisible, progressAnim, mediaIdx, media.length, closeViewer])

  const handlePressIn = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    animRef.current?.stop()
  }, [])

  const handlePressOut = useCallback((e: any) => {
    const dy = (e?.nativeEvent?.pageY || 0) - touchStartY.current
    if (dy > 120) {
      Animated.parallel([
        Animated.timing(viewerTranslateY, {
          toValue: SCREEN_HEIGHT, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(viewerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => closeViewer())
      return
    }
    if (dy > 10) {
      Animated.parallel([
        Animated.spring(viewerTranslateY, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
        Animated.spring(viewerOpacity, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      ]).start()
      return
    }
    if (!highlight || optionsVisible) return
    progressAnim.stopAnimation((val) => {
      const remaining = (1 - val) * 5000
      if (remaining <= 100) {
        if (mediaIdx < media.length - 1) {
          progressAnim.setValue(0)
          setMediaIdx(prev => prev + 1)
        } else {
          closeViewer()
        }
        return
      }
      animRef.current = Animated.timing(progressAnim, {
        toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false,
      })
      animRef.current.start()
      timerRef.current = setTimeout(() => {
        if (mediaIdx < media.length - 1) setMediaIdx(prev => prev + 1)
        else closeViewer()
      }, remaining)
    })
  }, [highlight, optionsVisible, progressAnim, mediaIdx, media.length, closeViewer, viewerTranslateY, viewerOpacity])

  const goNext = useCallback(() => {
    setMediaLoading(true)
    mediaOpacity.setValue(0)
    mediaTranslateX.setValue(SCREEN_WIDTH * 0.3)
    Animated.parallel([
      Animated.timing(mediaOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(mediaTranslateX, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start()
    if (mediaIdx < media.length - 1) {
      progressAnim.setValue(0)
      setMediaIdx(prev => prev + 1)
    } else {
      closeViewer()
    }
  }, [mediaIdx, media.length, closeViewer, progressAnim, mediaOpacity, mediaTranslateX])

  const goPrev = useCallback(() => {
    if (mediaIdx <= 0) return
    setMediaLoading(true)
    mediaOpacity.setValue(0)
    mediaTranslateX.setValue(-SCREEN_WIDTH * 0.3)
    Animated.parallel([
      Animated.timing(mediaOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(mediaTranslateX, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start()
    progressAnim.setValue(0)
    setMediaIdx(prev => prev - 1)
  }, [mediaIdx, mediaOpacity, mediaTranslateX, progressAnim])

  // Reset on highlight change
  useEffect(() => {
    if (!highlight) return
    viewerTranslateY.setValue(0)
    viewerOpacity.setValue(1)
    setMediaLoading(true)
    mediaOpacity.setValue(0)
    mediaTranslateX.setValue(SCREEN_WIDTH * 0.3)
    Animated.parallel([
      Animated.timing(mediaOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(mediaTranslateX, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start()
    if (prevHighlightId.current !== highlight.id) {
      prevHighlightId.current = highlight.id
      setMediaIdx(0)
      if (timerRef.current) clearTimeout(timerRef.current)
      animRef.current?.stop()
      progressTimerStarted.current = false
      const mediaUrls = highlight.mediaUrls && highlight.mediaUrls.length > 0
        ? highlight.mediaUrls
        : highlight.coverUrl ? [highlight.coverUrl] : []
      mediaUrls.forEach(url => {
        if (url && !url.includes('.mp4') && !url.includes('.mov')) {
          Image.prefetch(getOptimizedUrl(url))
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight?.id])

  // Start progress timer when ready
  useEffect(() => {
    if (!highlight || optionsVisible) return
    if (!mediaLoading && currentMedia) {
      startProgressTimer()
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      animRef.current?.stop()
      progressTimerStarted.current = false
    }
  }, [highlight, optionsVisible, mediaLoading, mediaIdx, currentMedia, startProgressTimer])

  const handleAddMedia = async () => {
    if (!highlight) return
    if (timerRef.current) clearTimeout(timerRef.current)
    animRef.current?.stop()
    try {
      const newUrls = await onAddMedia(highlight.id, media)
      if (newUrls.length > 0) {
        // onAddMedia should handle Firestore update, we just reset timer
      }
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'viewerAddMedia' })
    }
    progressTimerStarted.current = false
    progressAnim.setValue(0)
    startProgressTimer()
  }

  if (!visible && !highlight) return null

  return (
    <Modal visible={visible} transparent animationType="fade">
      {highlight && (
        <Animated.View
          style={{
            flex: 1, backgroundColor: '#000',
            transform: [{ translateY: viewerTranslateY }],
            opacity: viewerOpacity,
          }}
        >
          <View pointerEvents={optionsVisible ? 'none' : 'auto'} style={{ flex: 1 }}>
            {/* Progress bars */}
            <View style={{ flexDirection: 'row', gap: 3, paddingHorizontal: 12, paddingTop: 50, paddingBottom: 10 }}>
              {media.map((_: string, i: number) => (
                <View key={i} style={{ flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                  <Animated.View
                    style={{
                      height: '100%', backgroundColor: '#fff', borderRadius: 2,
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: i < mediaIdx ? ['100%', '100%'] : i === mediaIdx ? ['0%', '100%'] : ['0%', '0%'],
                      }),
                    }}
                  />
                </View>
              ))}
            </View>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#3A75C4', overflow: 'hidden' }}>
                {profileAvatar ? (
                  <Image source={{ uri: profileAvatar }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                ) : (
                  <Ionicons name="person" size={20} color="#555" />
                )}
              </View>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                {profilePseudo || ''}
              </Text>
              <Text style={{ color: '#888', fontSize: 12, marginLeft: 6 }}>• {highlight.title}</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setOptionsVisible(true)} style={{ padding: 8 }}>
                <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={closeViewer} style={{ padding: 8 }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Media */}
            <TouchableOpacity
              activeOpacity={1}
              onPressIn={(e) => { touchStartY.current = e?.nativeEvent?.pageY || 0; handlePressIn() }}
              onPressOut={handlePressOut}
              style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
            >
              <Animated.View style={{ width: '100%', height: '100%', opacity: mediaOpacity, transform: [{ translateX: mediaTranslateX }] }}>
                {(() => {
                  if (!currentMedia) return <Ionicons name="image-outline" size={64} color="#333" />
                  const isVideo = currentMedia.includes('.mp4') || currentMedia.includes('.mov')
                  const displayUrl = getOptimizedUrl(currentMedia)
                  if (isVideo) return (
                    <AVVideo
                      source={{ uri: displayUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay
                      isLooping
                      onReadyForDisplay={() => setMediaLoading(false)}
                    />
                  )
                  return (
                    <Image
                      source={{ uri: displayUrl }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                      onLoadEnd={() => setMediaLoading(false)}
                    />
                  )
                })()}
              </Animated.View>
              {mediaLoading && <OrbitLoader size={60} />}
            </TouchableOpacity>

            {/* Nav zones */}
            {mediaIdx > 0 && (
              <TouchableOpacity
                onPress={goPrev}
                onPressIn={(e) => { touchStartY.current = e?.nativeEvent?.pageY || 0; handlePressIn() }}
                onPressOut={handlePressOut}
                style={{ position: 'absolute', left: 0, top: 100, bottom: 0, width: '30%' }}
                activeOpacity={0.3}
              />
            )}
            <TouchableOpacity
              onPress={() => {
                if (mediaIdx < media.length - 1) {
                  goNext()
                } else {
                  closeViewer()
                }
              }}
              onPressIn={(e) => { touchStartY.current = e?.nativeEvent?.pageY || 0; handlePressIn() }}
              onPressOut={handlePressOut}
              style={{ position: 'absolute', right: 0, top: 100, bottom: 0, width: '30%' }}
              activeOpacity={0.3}
            />

            {/* Bottom gradient */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 20, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{highlight.title}</Text>
            </LinearGradient>
          </View>

          {/* Options overlay */}
          {optionsVisible && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setOptionsVisible(false)}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
              />
              <View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34 }}>
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444' }} />
                </View>
                <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
                  {highlight.title}
                </Text>
                {[
                  {
                    icon: 'pencil-outline' as const,
                    label: 'Modifier le titre',
                    action: () => {
                      setOptionsVisible(false)
                      closeViewer()
                      setTimeout(() => onEdit(highlight), 350)
                    },
                  },
                  {
                    icon: 'images-outline' as const,
                    label: 'Ajouter des médias',
                    action: () => {
                      setOptionsVisible(false)
                      setTimeout(handleAddMedia, 150)
                    },
                  },
                  {
                    icon: 'trash-outline' as const,
                    label: 'Supprimer la mise en avant',
                    color: colors.error,
                    action: () => {
                      setOptionsVisible(false)
                      onDelete(highlight.id)
                      closeViewer()
                    },
                  },
                ].map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={item.action}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 }}
                  >
                    <Ionicons name={item.icon} size={22} color={(item as any).color || colors.white} />
                    <Text style={{ color: (item as any).color || colors.white, fontSize: 15 }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </Modal>
  )
}
