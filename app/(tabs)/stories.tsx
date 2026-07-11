import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { colors } from '@/lib/theme'
import { useNewsFeed } from '@/features/news/hooks/useNewsFeed'
import { PostCard } from '@/features/news/components/PostCard'
import NewsCommentsModal from '@/features/news/components/NewsCommentsModal'
import { ContentActionsSheet } from '@/components/ContentActionsSheet'
import { useStoriesFeed } from '@/features/stories/hooks/useStoriesFeed'
import StoryViewer from '@/features/stories/components/StoryViewer'
import { StoryCard, CreateStoryCard } from '@/features/stories/components/StoryCard'
import { useStories } from '@/hooks/useStories'
import type { NewsPost } from '@/features/news/types'

export default function ActusScreen() {
  const uid = auth.currentUser?.uid ?? ''
  const { markAsViewed } = useStories()

  const {
    posts, loading, refreshing, loadingMore,
    refresh, loadMore, toggleLike, toggleSave, registerShare, deletePost, removePostsFromUser,
  } = useNewsFeed()

  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, 'users', uid), (snap: any) => {
      setFollowingIds(Array.isArray(snap.data()?.following) ? snap.data()!.following : [])
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

  const header = (
    <>
      <View style={styles.composer}>
        {auth.currentUser?.photoURL ? (
          <Image source={{ uri: auth.currentUser.photoURL }} style={styles.composerAvatar} />
        ) : (
          <View style={[styles.composerAvatar, styles.avatarFallback]}>
            <Ionicons name="person" size={18} color="#777" />
          </View>
        )}
        <Pressable onPress={() => router.push('/news-compose')} style={styles.composerInput}>
          <Text style={styles.composerPlaceholder}>Quoi de neuf ?</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/news-compose')} hitSlop={10}>
          <Ionicons name="images" size={24} color="#45BD62" />
        </Pressable>
      </View>

      <View style={styles.separator} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesRow}
      >
        <CreateStoryCard
          avatarUrl={myStoryGroup?.avatarUrl || auth.currentUser?.photoURL || undefined}
          onPress={() => (myStoryGroup ? openStory(uid) : router.push('/story-upload'))}
        />

        {myStoryGroup && (
          <StoryCard group={myStoryGroup} onPress={() => openStory(uid)} />
        )}

        {otherStoryGroups.map((group) => (
          <StoryCard key={group.userId} group={group} onPress={() => openStory(group.userId)} />
        ))}

        {storiesLoading && (
          <View style={{ width: 108, height: 168, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        )}
      </ScrollView>

      <View style={styles.separator} />
    </>
  )

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Actus</Text>
        <Pressable onPress={() => router.push('/(tabs)/explore')} style={styles.iconBtn}>
          <Ionicons name="search" size={22} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={uid}
            onLike={toggleLike}
            onSave={toggleSave}
            onShare={registerShare}
            onComment={setCommentPost}
            onPress={(post) => router.push({ pathname: '/post-detail', params: { postId: post.id } })}
            onEdit={(post) => router.push({ pathname: '/news-compose', params: { editPostId: post.id } })}
            onDelete={(post) => {
              Alert.alert('Supprimer ?', 'Cette action est définitive.', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Supprimer', style: 'destructive', onPress: () => deletePost(post.id) },
              ])
            }}
            onMore={setActionsPost}
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
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={48} color="#555" />
              <Text style={styles.emptyTitle}>Aucune publication</Text>
              <Text style={styles.emptyText}>Publiez la première actualité.</Text>
              <Pressable onPress={() => router.push('/news-compose')} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>Créer une publication</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} /> : null}
      />

      <NewsCommentsModal post={commentPost} visible={commentPost !== null} onClose={() => setCommentPost(null)} />

      {actionsPost && (
        <ContentActionsSheet
          visible
          targetType="post"
          targetId={actionsPost.id}
          contentOwnerId={actionsPost.userId}
          contentOwnerName={actionsPost.userName}
          onClose={() => setActionsPost(null)}
          onBlocked={() => { removePostsFromUser(actionsPost.userId); setActionsPost(null) }}
        />
      )}

      <Modal visible={viewerGroupIndex !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setViewerGroupIndex(null)}>
        {viewerGroupIndex !== null && (
          <StoryViewer
            groups={storyGroups}
            initialGroupIndex={viewerGroupIndex}
            onClose={() => setViewerGroupIndex(null)}
            onViewed={(storyId) => { if (uid) markAsViewed(storyId, uid) }}
          />
        )}
      </Modal>
    </SafeAreaView>
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

  composer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#111214',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerAvatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: '#25272A', alignItems: 'center', justifyContent: 'center' },
  composerInput: { flex: 1, height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#3A3C40', justifyContent: 'center' },
  composerPlaceholder: { color: '#C8C8C8', fontSize: 14 },

  separator: { height: 6, backgroundColor: '#08090A' },

  storiesRow: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#111214' },

  empty: { minHeight: 300, paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptyText: { color: '#888', fontSize: 13, marginTop: 5, textAlign: 'center' },
  emptyBtn: { marginTop: 16, height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
