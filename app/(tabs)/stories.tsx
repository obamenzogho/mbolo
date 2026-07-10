import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, Image, Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { useStoriesFeed } from '../../src/features/stories/hooks/useStoriesFeed'
import { useStories } from '../../src/hooks/useStories'
import { useHighlights } from '@/features/highlights/hooks/useHighlights'
import StoryViewer from '../../src/features/stories/components/StoryViewer'
import OrbitLoader from '../../src/components/OrbitLoader'

export default function StoriesScreen() {
  const router = useRouter()
  const user = auth.currentUser
  const uid = user?.uid ?? ''

  const { markAsViewed, cleanExpiredStories } = useStories()
  const { highlights, loading: highlightsLoading } = useHighlights(uid)

  const [followingIds, setFollowingIds] = useState<string[]>([])
  useEffect(() => {
    if (!uid) return
    const unsub = onSnapshot(doc(db, 'users', uid), (snap: any) => {
      const data = snap.data()
      setFollowingIds(Array.isArray(data?.following) ? data.following : [])
    })
    return unsub
  }, [uid])

  const { groups, loading } = useStoriesFeed(followingIds)

  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null)

  useEffect(() => { cleanExpiredStories() }, [])

  const myGroup = useMemo(() => groups.find((g) => g.userId === uid), [groups, uid])
  const otherGroups = useMemo(() => groups.filter((g) => g.userId !== uid), [groups, uid])

  const openViewerForUser = (userId: string) => {
    const idx = groups.findIndex((g) => g.userId === userId)
    if (idx !== -1) setViewerGroupIndex(idx)
  }

  const ready = !loading && !highlightsLoading

  const StoryRing = ({
    avatarUrl, hasUnseen, size = 68,
  }: { avatarUrl?: string; hasUnseen: boolean; size?: number }) => {
    const inner = size - 8
    const AvatarImg = avatarUrl
      ? <Image source={{ uri: avatarUrl }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
      : (
        <View style={{
          width: inner, height: inner, borderRadius: inner / 2, backgroundColor: '#333',
          alignItems: 'center', justifyContent: 'center',
        }}
        >
          <Ionicons name="person" size={inner / 2} color="#888" />
        </View>
      )

    if (hasUnseen) {
      return (
        <LinearGradient
          colors={['#4361EE', '#3A0CA3']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{
            width: inner + 4, height: inner + 4, borderRadius: (inner + 4) / 2,
            backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center',
          }}
          >
            {AvatarImg}
          </View>
        </LinearGradient>
      )
    }
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 2, borderColor: '#555', alignItems: 'center', justifyContent: 'center',
      }}
      >
        {AvatarImg}
      </View>
    )
  }

  const StoryCard = ({
    avatarUrl, previewUrl, username, hasUnseen, size = 110,
  }: { avatarUrl?: string; previewUrl?: string; username: string; hasUnseen: boolean; size?: number }) => (
    <View style={{ width: size, height: size * 1.6, borderRadius: 16, overflow: 'hidden' }}>
      {previewUrl ? (
        <Image source={{ uri: previewUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <View style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e' }} />
      )}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }}
      />
      <View style={{ position: 'absolute', top: 8, left: 8 }}>
        <StoryRing avatarUrl={avatarUrl} hasUnseen={hasUnseen} size={52} />
      </View>
      <Text numberOfLines={1} style={{ position: 'absolute', bottom: 8, left: 8, right: 8, color: '#fff', fontSize: 14, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 }}>
        {username}
      </Text>
    </View>
  )

  const renderOtherGroup = ({ item }: { item: typeof otherGroups[number] }) => (
    <TouchableOpacity onPress={() => openViewerForUser(item.userId)} style={{ marginRight: 10 }}>
      <StoryCard
        avatarUrl={item.avatarUrl}
        previewUrl={item.stories[0]?.mediaUrl}
        username={item.username}
        hasUnseen={item.hasUnseen}
      />
    </TouchableOpacity>
  )

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' }}>
        <OrbitLoader />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
      }}
      >
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>Stories</Text>
        <TouchableOpacity
          onPress={() => router.push('/story-upload')}
          style={{
            width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: colors.primary,
          }}
        >
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={otherGroups}
        keyExtractor={(item) => item.userId}
        renderItem={renderOtherGroup}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 2 }}
        ListHeaderComponent={
          <View style={{ marginRight: 10 }}>
            <TouchableOpacity
              onPress={() => myGroup && openViewerForUser(uid)}
              style={{ width: 110, height: 176, borderRadius: 16, overflow: 'hidden' }}
            >
              {myGroup?.stories[0]?.mediaUrl ? (
                <Image source={{ uri: myGroup.stories[0].mediaUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e' }} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }}
              />
              <View style={{ position: 'absolute', top: 8, left: 8 }}>
                <StoryRing
                  avatarUrl={user?.photoURL || undefined}
                  hasUnseen={false}
                  size={52}
                />
              </View>
              <Text numberOfLines={1} style={{ position: 'absolute', bottom: 8, left: 8, right: 8, color: '#fff', fontSize: 14, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 }}>
                Votre story
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/story-upload')}
              style={{
                position: 'absolute', bottom: 28, left: '50%',
                marginLeft: -20,
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: colors.black,
              }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          !myGroup ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
              <Text style={{ color: colors.textSecondary }}>Aucune story pour le moment</Text>
            </View>
          ) : null
        }
      />

      {highlights.length > 0 && (
        <>
          <Text style={{
            color: colors.text, fontSize: 16, fontWeight: '600',
            paddingHorizontal: 16, marginTop: 8, marginBottom: 8,
          }}
          >
            Mises en avant
          </Text>
          <FlatList
            data={highlights}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={{ alignItems: 'center', marginRight: 16, width: 72 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32, borderWidth: 2,
                  borderColor: '#555', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}
                >
                  {item.coverUrl ? (
                    <Image source={{ uri: item.coverUrl }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                  ) : (
                    <Ionicons name="bookmark" size={24} color="#888" />
                  )}
                </View>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, marginTop: 6, maxWidth: 72 }}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      <Modal visible={viewerGroupIndex !== null} animationType="fade" transparent={false} onRequestClose={() => setViewerGroupIndex(null)}>
        {viewerGroupIndex !== null && (
          <StoryViewer
            groups={groups}
            initialGroupIndex={viewerGroupIndex}
            onClose={() => setViewerGroupIndex(null)}
            onViewed={(storyId) => markAsViewed(storyId, uid)}
          />
        )}
      </Modal>
    </SafeAreaView>
  )
}
