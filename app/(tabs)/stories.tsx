import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { colors } from '@/lib/theme'
import { newsFeedStore, useNewsFeedStore } from '@/features/news/store/newsFeedStore'
import { useNewsFeedData } from '@/features/news/hooks/useNewsFeedData'
import { PostCard } from '@/features/news/components/PostCard'
import NewsCommentsModal from '@/features/news/components/NewsCommentsModal'
import { deletePost } from '@/features/news/services/postMutations'
import { newsFeedSource } from '@/features/news/services/newsFeedSource'
import { ContentActionsSheet } from '@/components/ContentActionsSheet'
import { useStoriesFeed } from '@/features/stories/hooks/useStoriesFeed'
import StoryViewer from '@/features/stories/components/StoryViewer'
import { StoryCard, CreateStoryCard } from '@/features/stories/components/StoryCard'
import { StoryCardSkeleton, PostCardSkeleton } from '@/features/news/components/Skeletons'
import { useStories } from '@/hooks/useStories'
import type { NewsPost } from '@/features/news/types'
import PageWrapper from '@/components/PageWrapper'

export default function ActusScreen() {
  const uid = auth.currentUser?.uid ?? ''
  const { markAsViewed } = useStories()

  const {
    refresh: refreshFeed,
    loadMore: loadMoreFeed,
  } = useNewsFeedData({ store: newsFeedStore })

  const posts = useNewsFeedStore(
    (state) => state.posts,
  )

  const loading = useNewsFeedStore(
    (state) => state.loading,
  )

  const refreshing = useNewsFeedStore(
    (state) => state.refreshing,
  )

  const loadingMore = useNewsFeedStore(
    (state) => state.loadingMore,
  )

  const hasMore = useNewsFeedStore(
    (state) => state.hasMore,
  )

  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null)
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, 'users', uid), (snap: any) => {
      const data = snap.data()
      setFollowingIds(Array.isArray(data?.following) ? data!.following : [])
      setUserPhotoURL(data?.photoURL || null)
    })
  }, [uid])

  const { groups: storyGroups, loading: storiesLoading } = useStoriesFeed(followingIds)

  const myStoryGroup = useMemo(() => storyGroups.find((g) => g.userId === uid), [storyGroups, uid])
  const otherStoryGroups = useMemo(() => storyGroups.filter((g) => g.userId !== uid), [storyGroups, uid])

  const openStory = (userId: string) => {
    const idx = storyGroups.findIndex((g) => g.userId === userId)
    if (idx !== -1) setViewerGroupIndex(idx)
  }

  const [commentPost, setCommentPost] = useState<NewsPost | null>(null)
  const [actionsPost, setActionsPost] = useState<NewsPost | null>(null)

  const handleRefresh = useCallback(() => {
  void refreshFeed()
}, [refreshFeed])

const handleLoadMore = useCallback(() => {
  void loadMoreFeed()
}, [loadMoreFeed])

  const renderPostItem = useCallback(
  ({ item }: { item: NewsPost }) => (
    <PostCard
      post={item}
      currentUserId={uid}
      onComment={setCommentPost}
      onEdit={(post) =>
        router.push({
          pathname: '/news-compose',
          params: {
            editPostId: post.id,
          },
        })
      }
      onDelete={(post) => {
        Alert.alert(
          'Supprimer ?',
          'Cette action est définitive.',
          [
            {
              text: 'Annuler',
              style: 'cancel',
            },
            {
              text: 'Supprimer',
              style: 'destructive',
              onPress: async () => {
                newsFeedStore
                  .getState()
                  .removePost(post.id)

                await deletePost(post.id, uid)
              },
            },
          ],
        )
      }}
      onMore={setActionsPost}
      onPress={(post) =>
        router.push({
          pathname: '/post-detail',
          params: {
            postId: post.id,
          },
        })
      }
    />
  ),
  [uid],
)

  const header = (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
      >
        <CreateStoryCard
          avatarUrl={myStoryGroup?.avatarUrl || userPhotoURL || auth.currentUser?.photoURL || undefined}
          onPress={() => (myStoryGroup ? openStory(uid) : router.push('/story-upload'))}
        />

        {myStoryGroup && (
          <StoryCard group={myStoryGroup} onPress={() => openStory(uid)} />
        )}

        {otherStoryGroups.map((group) => (
          <StoryCard key={group.userId} group={group} onPress={() => openStory(group.userId)} />
        ))}

        {storiesLoading && (
          <>
            <StoryCardSkeleton />
            <StoryCardSkeleton />
            <StoryCardSkeleton />
          </>
        )}
      </ScrollView>

      <View style={styles.separator} />
    </>
  )

  return (
    <PageWrapper type="stack" swipeBack swipeBackEdgeOnly>
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Actus</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => router.push('/news-compose')}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Ionicons name="add-circle" size={24} color={colors.primary} />
         </Pressable>
          <Pressable onPress={() => router.push({ pathname: '/explore', params: { from: '/(tabs)/stories' } })} style={styles.iconBtn}>
            <Ionicons name="search" size={22} color="#fff" />
         </Pressable>
       </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPostItem}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{
          backgroundColor: '#111214',
        }}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={
          hasMore ? handleLoadMore : undefined
        }
        onEndReachedThreshold={0.7}
        showsVerticalScrollIndicator={false}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        removeClippedSubviews
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        ListEmptyComponent={
          loading ? (
            <View>
              <PostCardSkeleton />
              <PostCardSkeleton />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons
                name="newspaper-outline"
                size={42}
                color={colors.textMuted}
              />

              <Text style={styles.emptyTitle}>
                Aucune publication
              </Text>

              <Text style={styles.emptyText}>
                Publiez la première actualité.
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Créer une publication"
                onPress={() =>
                  router.push('/news-compose')
                }
                style={styles.emptyBtn}
              >
                <Text style={styles.emptyBtnText}>
                  Créer une publication
                </Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <PostCardSkeleton />
            </View>
          ) : null
        }
      />

      {commentPost && (
        <NewsCommentsModal key={commentPost.id} post={commentPost} visible onClose={() => setCommentPost(null)} />
      )}

      {actionsPost && (
        <ContentActionsSheet
          visible
          targetType="post"
          targetId={actionsPost.id}
          contentOwnerId={actionsPost.userId}
          contentOwnerName={actionsPost.userName}
          onClose={() => setActionsPost(null)}
          onBlocked={() => {
            const blockedUserId = actionsPost.userId
            setActionsPost(null)
            newsFeedStore.getState().setPosts(
              newsFeedStore.getState().posts.filter((p) => p.userId !== blockedUserId),
            )
            newsFeedSource.reset()
          }}
        />
      )}

      {viewerGroupIndex !== null && (
        <Modal animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setViewerGroupIndex(null)}>
          <StoryViewer
            groups={storyGroups}
            initialGroupIndex={viewerGroupIndex}
            onClose={() => setViewerGroupIndex(null)}
            onViewed={(storyId) => { if (uid) markAsViewed(storyId, uid) }}
          />
        </Modal>
      )}
    </SafeAreaView>
    </PageWrapper>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' },
  topBar: {
    height: 54,
    paddingHorizontal: 16,
    backgroundColor: '#111214',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2B2E',
  },
  title: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#292B2F', alignItems: 'center', justifyContent: 'center' },

  separator: { height: 6, backgroundColor: '#08090A' },

  storiesRow: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#111214' },

  footerLoader: {
    paddingBottom: 24,
  },

  empty: {
    minHeight: 300,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },

  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },

  emptyBtn: {
    marginTop: 18,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
})
