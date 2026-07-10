import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { colors } from '@/lib/theme'
import { useNewsFeed } from '@/features/news/hooks/useNewsFeed'
import { PostCard } from '@/features/news/components/PostCard'
import { useStoriesFeed } from '@/features/stories/hooks/useStoriesFeed'
import StoryViewer from '@/features/stories/components/StoryViewer'
import { useStories } from '@/hooks/useStories'
import type { StoryGroup } from '@/features/stories/hooks/useStoriesFeed'

function StoryItem({
  group,
  onPress,
}: {
  group: StoryGroup
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={styles.storyItem}>
      <View
        style={[
          styles.storyRing,
          {
            borderColor: group.hasUnseen
              ? colors.primary
              : '#4C4E52',
          },
        ]}
      >
        {group.avatarUrl ? (
          <Image
            source={{ uri: group.avatarUrl }}
            style={styles.storyAvatar}
          />
        ) : (
          <View style={[styles.storyAvatar, styles.avatarFallback]}>
            <Ionicons name="person" size={28} color="#777" />
          </View>
        )}
      </View>

      <Text numberOfLines={1} style={styles.storyName}>
        {group.username}
      </Text>
    </Pressable>
  )
}

export default function NewsScreen() {
  const uid = auth.currentUser?.uid ?? ''

  const {
    posts,
    loading,
    refreshing,
    loadingMore,
    refresh,
    loadMore,
    toggleLike,
    registerShare,
  } = useNewsFeed()

  const { markAsViewed } = useStories()
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [viewerGroupIndex, setViewerGroupIndex] =
    useState<number | null>(null)

  useEffect(() => {
    if (!uid) return

    return onSnapshot(
      doc(db, 'users', uid),
      (snapshot: any) => {
        const following = snapshot.data()?.following
        setFollowingIds(
          Array.isArray(following) ? following : [],
        )
      },
    )
  }, [uid])

  const {
    groups: storyGroups,
    loading: storiesLoading,
  } = useStoriesFeed(followingIds)

  const myStoryGroup = useMemo(
    () => storyGroups.find((group) => group.userId === uid),
    [storyGroups, uid],
  )

  const otherStoryGroups = useMemo(
    () => storyGroups.filter((group) => group.userId !== uid),
    [storyGroups, uid],
  )

  const openStory = (userId: string) => {
    const index = storyGroups.findIndex(
      (group) => group.userId === userId,
    )

    if (index !== -1) {
      setViewerGroupIndex(index)
    }
  }

  const header = (
    <>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Actus</Text>

        <View style={styles.topActions}>
          <Pressable
            onPress={() => router.push('/news-compose')}
            style={styles.circleButton}
          >
            <Ionicons name="add" size={25} color="#fff" />
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/explore')}
            style={styles.circleButton}
          >
            <Ionicons name="search" size={21} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.composer}>
        {auth.currentUser?.photoURL ? (
          <Image
            source={{ uri: auth.currentUser.photoURL }}
            style={styles.composerAvatar}
          />
        ) : (
          <View
            style={[
              styles.composerAvatar,
              styles.avatarFallback,
            ]}
          >
            <Ionicons name="person" size={20} color="#777" />
          </View>
        )}

        <Pressable
          onPress={() => router.push('/news-compose')}
          style={styles.composerInput}
        >
          <Text style={styles.composerPlaceholder}>
            Quoi de neuf ?
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/news-compose')}
          hitSlop={10}
        >
          <Ionicons name="images" size={25} color="#45BD62" />
        </Pressable>
      </View>

      <View style={styles.sectionSeparator} />

      <View style={styles.storiesHeader}>
        <Text style={styles.sectionTitle}>Stories</Text>

        <Pressable onPress={() => router.push('/story-upload')}>
          <Text style={styles.seeAll}>Créer</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesContent}
      >
        <Pressable
          onPress={() =>
            myStoryGroup
              ? openStory(uid)
              : router.push('/story-upload')
          }
          style={styles.storyItem}
        >
          <View>
            <View
              style={[
                styles.storyRing,
                {
                  borderColor: myStoryGroup?.hasUnseen
                    ? colors.primary
                    : '#4C4E52',
                },
              ]}
            >
              {auth.currentUser?.photoURL ? (
                <Image
                  source={{ uri: auth.currentUser.photoURL }}
                  style={styles.storyAvatar}
                />
              ) : (
                <View
                  style={[
                    styles.storyAvatar,
                    styles.avatarFallback,
                  ]}
                >
                  <Ionicons name="person" size={28} color="#777" />
                </View>
              )}
            </View>

            <View style={styles.storyAdd}>
              <Ionicons name="add" size={15} color="#fff" />
            </View>
          </View>

          <Text numberOfLines={1} style={styles.storyName}>
            Votre story
          </Text>
        </Pressable>

        {otherStoryGroups.map((group) => (
          <StoryItem
            key={group.userId}
            group={group}
            onPress={() => openStory(group.userId)}
          />
        ))}

        {storiesLoading && (
          <View style={styles.storiesLoader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </ScrollView>

      <View style={styles.sectionSeparator} />
    </>
  )

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={uid}
            onLike={toggleLike}
            onShare={registerShare}
          />
        )}
        ListHeaderComponent={header}
        refreshing={refreshing}
        onRefresh={refresh}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator
                size="large"
                color={colors.primary}
              />
              <Text style={styles.emptyText}>
                Chargement des actualités…
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons
                name="newspaper-outline"
                size={52}
                color="#555"
              />
              <Text style={styles.emptyTitle}>
                Aucune publication
              </Text>
              <Text style={styles.emptyText}>
                Soyez la première personne à publier une actualité.
              </Text>
              <Pressable
                onPress={() => router.push('/news-compose')}
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonText}>
                  Créer une publication
                </Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null
        }
      />

      <Modal
        visible={viewerGroupIndex !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setViewerGroupIndex(null)}
      >
        {viewerGroupIndex !== null && (
          <StoryViewer
            groups={storyGroups}
            initialGroupIndex={viewerGroupIndex}
            onClose={() => setViewerGroupIndex(null)}
            onViewed={(storyId) => {
              if (uid) markAsViewed(storyId, uid)
            }}
          />
        )}
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#08090A',
  },
  topBar: {
    height: 58,
    paddingHorizontal: 14,
    backgroundColor: '#111214',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  topActions: {
    flexDirection: 'row',
    gap: 9,
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#292B2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    minHeight: 72,
    paddingHorizontal: 14,
    gap: 10,
    backgroundColor: '#111214',
    flexDirection: 'row',
    alignItems: 'center',
  },
  composerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarFallback: {
    backgroundColor: '#25272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 15,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#3A3C40',
    justifyContent: 'center',
  },
  composerPlaceholder: {
    color: '#C8C8C8',
    fontSize: 15,
  },
  sectionSeparator: {
    height: 8,
    backgroundColor: '#08090A',
  },
  storiesHeader: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 5,
    backgroundColor: '#111214',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  seeAll: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  storiesContent: {
    minHeight: 110,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 13,
    backgroundColor: '#111214',
  },
  storyItem: {
    width: 76,
    marginRight: 10,
    alignItems: 'center',
  },
  storyRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  storyAdd: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#111214',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyName: {
    maxWidth: 74,
    marginTop: 6,
    color: '#D8D8D8',
    fontSize: 11,
    textAlign: 'center',
  },
  storiesLoader: {
    width: 60,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    minHeight: 320,
    paddingHorizontal: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '700',
    marginTop: 14,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },
  emptyButton: {
    marginTop: 18,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  footerLoader: {
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
