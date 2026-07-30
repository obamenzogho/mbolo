import { useCallback, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { auth } from '@/lib/firebase'
import OrbitLoader from '@/components/OrbitLoader'
import { PostCard } from './components/PostCard'
import NewsCommentsModal from './components/NewsCommentsModal'
import { newsFeedStore } from './store/newsFeedStore'
import { useNewsFeedData } from './hooks/useNewsFeedData'
import type { NewsPost } from './types'

interface NewsFeedScreenProps {
  isActive?: boolean
}

export default function NewsFeedScreen({
  isActive = true,
}: NewsFeedScreenProps) {
  const {
    posts,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
  } = useNewsFeedData({
    store: newsFeedStore,
    enabled: isActive,
  })

  const [commentPost, setCommentPost] = useState<NewsPost | null>(null)
  const currentUserId = auth.currentUser?.uid ?? ''

  const handleComment = useCallback((post: NewsPost) => {
    setCommentPost(post)
  }, [])

  const handleSave = useCallback((postId: string) => {
    void postId
  }, [])

  const handleEdit = useCallback((post: NewsPost) => {
    void post
  }, [])

  const handleDelete = useCallback((post: NewsPost) => {
    void post
  }, [])

  const handleMore = useCallback((post: NewsPost) => {
    void post
  }, [])

  if (loading && posts.length === 0) {
    return (
      <View style={styles.loader}>
        <OrbitLoader />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={currentUserId}
            onComment={handleComment}
            onSave={handleSave}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onMore={handleMore}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.7}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#00C853"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucune actu</Text>
            <Text style={styles.emptyText}>
              Les nouvelles publications apparaîtront ici.
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <OrbitLoader size={48} />
            </View>
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.end}>Tu es à jour</Text>
          ) : null
        }
      />

      <NewsCommentsModal
        post={commentPost}
        visible={commentPost !== null}
        onClose={() => setCommentPost(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08090A',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#08090A',
  },
  empty: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  end: {
    color: '#777',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
})
