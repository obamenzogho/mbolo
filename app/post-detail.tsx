import { useEffect, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { colors } from '@/lib/theme'
import { PostCard } from '@/features/news/components/PostCard'
import NewsCommentsModal from '@/features/news/components/NewsCommentsModal'
import { deletePost } from '@/features/news/services/postMutations'
import { toDate } from '@/features/news/utils'
import { ContentActionsSheet } from '@/components/ContentActionsSheet'
import OrbitLoader from '@/components/OrbitLoader'
import { BackButton } from '@/components/ui/BackButton'
import type { NewsPost } from '@/features/news/types'
import PageWrapper from '@/components/PageWrapper'

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>()
  const router = useRouter()
  const uid = auth.currentUser?.uid ?? ''
  const [post, setPost] = useState<NewsPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentPost, setCommentPost] = useState<NewsPost | null>(null)
  const [actionsPost, setActionsPost] = useState<NewsPost | null>(null)

  useEffect(() => {
    if (!postId) return

    let cancelled = false

    getDoc(doc(db, 'posts', postId)).then((snap) => {
      if (cancelled || !snap.exists()) {
        setLoading(false)
        return
      }

      const data = snap.data()

      setPost({
        id: snap.id,
        userId: data.userId,
        userName: data.userName || 'Utilisateur',
        userPhotoURL: data.userPhotoURL || undefined,
        text: data.text || '',
        format: data.format || 'text',
        media: Array.isArray(data.media) ? data.media : [],
        visibility: data.visibility || 'public',
        commentsEnabled: data.commentsEnabled !== false,
        likes: data.likes ?? 0,
        likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
        comments: data.comments ?? 0,
        shares: data.shares ?? 0,
        saves: data.saves ?? 0,
        savedBy: Array.isArray(data.savedBy) ? data.savedBy : [],
        createdAt: toDate(data.createdAt),
        background: data.background || undefined,
        location: data.location || undefined,
        mood: data.mood || undefined,
        poll: data.poll || undefined,
      })

      setLoading(false)
    })

    return () => { cancelled = true }
  }, [postId])

  if (loading || !post) {
    return (
      <SafeAreaView style={styles.screen}>
        <BackButton />
        <View style={styles.center}>
          <OrbitLoader size={48} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <PageWrapper type="stack" swipeBack backTo="/(tabs)/feed">
      <SafeAreaView style={styles.screen}>
        <BackButton />

        <ScrollView>
          <PostCard
            post={post}
            currentUserId={uid}
            onComment={setCommentPost}
            onEdit={(p) => router.push({ pathname: '/news-compose', params: { editPostId: p.id } })}
            onDelete={async () => {
              if (!post) return
              const ok = await deletePost(post.id, uid)
              if (ok) router.back()
            }}
            onMore={setActionsPost}
          />
        </ScrollView>

        <NewsCommentsModal
          post={commentPost}
          visible={commentPost !== null}
          onClose={() => setCommentPost(null)}
        />

        {actionsPost && (
          <ContentActionsSheet
            visible
            targetType="post"
            targetId={actionsPost.id}
            contentOwnerId={actionsPost.userId}
            contentOwnerName={actionsPost.userName}
            onClose={() => setActionsPost(null)}
            onBlocked={() => {
              setActionsPost(null)
              router.back()
            }}
          />
        )}
      </SafeAreaView>
    </PageWrapper>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
