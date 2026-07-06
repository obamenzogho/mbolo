import { useState, useEffect, useRef } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Image, Dimensions,
  Modal, Animated, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { auth } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { useStories } from '../../src/hooks/useStories'
import { useHighlights } from '@/features/highlights/hooks/useHighlights'
import OrbitLoader from '../../src/components/OrbitLoader'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

export default function StoriesScreen() {
  const router = useRouter()
  const user = auth.currentUser
  const { myStories, loading, cleanExpiredStories } = useStories()
  const { highlights, loading: highlightsLoading } = useHighlights(user?.uid || '')

  const [groupedStories, setGroupedStories] = useState<{ userId: string; username: string; avatarUrl: string; stories: any[] }[]>([])
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [viewingIndex, setViewingIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)

  const progressAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const STORY_DURATION = 5000

  useEffect(() => {
    cleanExpiredStories()
  }, [])

  useEffect(() => {
    const groups = new Map<string, { userId: string; username: string; avatarUrl: string; stories: any[] }>()
    for (const story of myStories) {
      if (!groups.has(story.userId)) {
        groups.set(story.userId, {
          userId: story.userId,
          username: story.username,
          avatarUrl: story.avatarUrl,
          stories: [],
        })
      }
      groups.get(story.userId)!.stories.push(story)
    }
    setGroupedStories(Array.from(groups.values()))
  }, [myStories])

  useEffect(() => {
    if (!loading && !highlightsLoading) setReady(true)
  }, [loading, highlightsLoading])

  const startProgress = () => {
    progressAnim.setValue(0)
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        goToNext()
      }
    })
  }

  const goToNext = () => {
    const group = groupedStories.find(g => g.userId === viewingUserId)
    if (!group) return
    if (viewingIndex < group.stories.length - 1) {
      setViewingIndex(viewingIndex + 1)
      setProgress(0)
      progressAnim.setValue(0)
      startProgress()
    } else {
      const currentGroupIdx = groupedStories.findIndex(g => g.userId === viewingUserId)
      if (currentGroupIdx < groupedStories.length - 1) {
        const nextGroup = groupedStories[currentGroupIdx + 1]
        setViewingUserId(nextGroup.userId)
        setViewingIndex(0)
        setProgress(0)
        progressAnim.setValue(0)
        startProgress()
      } else {
        closeViewer()
      }
    }
  }

  const goToPrev = () => {
    if (viewingIndex > 0) {
      setViewingIndex(viewingIndex - 1)
      setProgress(0)
      progressAnim.setValue(0)
      startProgress()
    } else {
      const currentGroupIdx = groupedStories.findIndex(g => g.userId === viewingUserId)
      if (currentGroupIdx > 0) {
        const prevGroup = groupedStories[currentGroupIdx - 1]
        setViewingUserId(prevGroup.userId)
        setViewingIndex(prevGroup.stories.length - 1)
        setProgress(0)
        progressAnim.setValue(0)
        startProgress()
      }
    }
  }

  const openViewer = (userId: string) => {
    setViewingUserId(userId)
    setViewingIndex(0)
    setProgress(0)
    progressAnim.setValue(0)
    setTimeout(() => startProgress(), 300)
  }

  const closeViewer = () => {
    setViewingUserId(null)
    setViewingIndex(0)
    progressAnim.setValue(0)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  useEffect(() => {
    const listener = progressAnim.addListener(({ value }) => setProgress(value))
    return () => { progressAnim.removeListener(listener) }
  }, [])

  const renderStoryGroup = ({ item }: { item: { userId: string; username: string; avatarUrl: string; stories: any[] } }) => {
    const isCurrentUser = item.userId === user?.uid
    const hasNew = item.stories.some(s => {
      const created = s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : new Date()
      return (Date.now() - created.getTime()) < 24 * 60 * 60 * 1000
    })

    return (
      <TouchableOpacity
        onPress={() => openViewer(item.userId)}
        style={{ alignItems: 'center', marginRight: 16 }}
      >
        <View style={{
          width: 68, height: 68, borderRadius: 34,
          borderWidth: 2,
          borderColor: hasNew ? colors.primary : '#444',
          padding: 2,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#111',
        }}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={{ width: 60, height: 60, borderRadius: 30 }} />
          ) : (
            <Ionicons name="person" size={32} color="#555" />
          )}
          {isCurrentUser && (
            <View style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: colors.primary,
              justifyContent: 'center', alignItems: 'center',
              borderWidth: 2, borderColor: '#000',
            }}>
              <Ionicons name="add" size={12} color="#fff" />
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={{ color: '#fff', fontSize: 11, marginTop: 4, width: 68, textAlign: 'center' }}>
          {isCurrentUser ? 'Votre story' : item.username}
        </Text>
      </TouchableOpacity>
    )
  }

  const currentGroup = groupedStories.find(g => g.userId === viewingUserId)
  const currentStory = currentGroup?.stories[viewingIndex]

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      {/* HEADER */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>Stories</Text>
        <TouchableOpacity
          onPress={() => router.push('/story-upload')}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary }}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* STORY CIRCLES */}
      <FlatList
        data={groupedStories}
        keyExtractor={item => item.userId}
        renderItem={renderStoryGroup}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Ionicons name="images-outline" size={64} color="#333" />
            <Text style={{ color: '#555', fontSize: 14, marginTop: 12 }}>Aucune story</Text>
            <TouchableOpacity
              onPress={() => router.push('/story-upload')}
              style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Créer une story</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* HIGHLIGHTS */}
      {highlights.length > 0 && (
        <>
          <Text style={{ color: '#888', fontSize: 14, fontWeight: '600', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
            Mises en avant
          </Text>
          <FlatList
            data={highlights}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profile')}
                style={{ alignItems: 'center', marginRight: 16 }}
              >
                <View style={{
                  width: 68, height: 68, borderRadius: 34,
                  borderWidth: 2, borderColor: '#333',
                  overflow: 'hidden', backgroundColor: '#111',
                }}>
                  {item.coverUrl ? (
                    <Image source={{ uri: item.coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="albums" size={28} color="#444" />
                    </View>
                  )}
                </View>
                <Text numberOfLines={1} style={{ color: '#fff', fontSize: 11, marginTop: 4, width: 68, textAlign: 'center' }}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {/* FULLSCREEN VIEWER */}
      <Modal visible={!!viewingUserId} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* PROGRESS BARS */}
          {currentGroup && (
            <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 8 }}>
              {currentGroup.stories.map((_, i) => (
                <View key={i} style={{ flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1 }}>
                  {i === viewingIndex && (
                    <Animated.View style={{
                      height: '100%', backgroundColor: '#fff', borderRadius: 1,
                      width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    }} />
                  )}
                  {i < viewingIndex && (
                    <View style={{ height: '100%', backgroundColor: '#fff', borderRadius: 1, width: '100%' }} />
                  )}
                </View>
              ))}
            </View>
          )}

          {/* USER INFO */}
          {currentGroup && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
              {currentGroup.avatarUrl ? (
                <Image source={{ uri: currentGroup.avatarUrl }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 8 }} />
              ) : (
                <Ionicons name="person-circle" size={32} color="#fff" style={{ marginRight: 8 }} />
              )}
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{currentGroup.username}</Text>
              <TouchableOpacity onPress={closeViewer} style={{ marginLeft: 'auto', padding: 4 }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* MEDIA */}
          {currentStory && (
            <View style={{ flex: 1 }}>
              {currentStory.mediaType === 'video' ? (
                <Text style={{ color: '#fff', textAlign: 'center', marginTop: '40%' }}>🎬 Vidéo</Text>
              ) : (
                <Image source={{ uri: currentStory.mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              )}

              {/* CAPTION */}
              {currentStory.caption && (
                <View style={{ position: 'absolute', bottom: 40, left: 16, right: 16 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{currentStory.caption}</Text>
                </View>
              )}

              {/* TAP ZONES */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' }}>
                <TouchableOpacity onPress={goToPrev} style={{ flex: 1 }} activeOpacity={1} />
                <TouchableOpacity onPress={goToNext} style={{ flex: 2 }} activeOpacity={1} />
              </View>
            </View>
          )}

          {loading && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
              <OrbitLoader size={80} />
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}
