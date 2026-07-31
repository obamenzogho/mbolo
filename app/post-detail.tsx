import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { colors } from '@/lib/theme'
import { PostCard } from '@/features/news/components/post/PostCard'
import type { PostViewerState } from '@/features/news/components/post/PostCard'
import NewsCommentsModal from '@/features/news/components/NewsCommentsModal'
import ImageGalleryModal from '@/features/news/components/ImageGalleryModal'
import { deletePost } from '@/features/news/services/postMutations'
import { usePostInteractions } from '@/features/news/hooks/usePostInteractions'
import { ContentActionsSheet } from '@/components/ContentActionsSheet'
import OrbitLoader from '@/components/OrbitLoader'
import { BackButton } from '@/components/ui/BackButton'
import { toDate } from '@/features/news/utils'
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
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(true)

  const toggleExpanded = useCallback(() => {
    setExpanded((previous) => !previous)
  }, [])

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
        reposts: data.reposts ?? 0,
        repostedBy: Array.isArray(data.repostedBy) ? data.repostedBy : [],
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

  /* Interactions optimistes ciblées sur l'état local (le post n'est pas dans
     le store du fil) : on injecte un `patch` local à usePostInteractions. */
  const patch = useCallback(
    (id: string, updates: Partial<NewsPost>) => {
      setPost((previous) =>
        previous && previous.id === id
          ? { ...previous, ...updates }
          : previous,
      )
    },
    [],
  )

  const interactions = usePostInteractions({
    store: undefined,
    currentUserId: uid,
    patch,
  })

  const viewer: PostViewerState = post
    ? {
        liked: post.likedBy.includes(uid),
        saved: post.savedBy.includes(uid),
        reposted: post.repostedBy.includes(uid),
        repostCount: post.reposts,
        repostPending: false,
      }
    : {
        liked: false,
        saved: false,
        reposted: false,
        repostCount: 0,
        repostPending: false,
      }

  const noop = useCallback(() => {}, [])

  const openAuthor = useCallback(
    (userId: string) => {
      router.push({
        pathname: '/user/[userId]',
        params: { userId },
      })
    },
    [router],
  )

  const openComments = useCallback((target: NewsPost) => {
    setCommentPost(target)
  }, [])

  const openMedia = useCallback((target: NewsPost, index: number) => {
    setGalleryIndex(index)
  }, [])

  const openOptions = useCallback(
    (target: NewsPost) => {
      if (target.userId !== uid) {
        setActionsPost(target)
        return
      }

      Alert.alert('Publication', undefined, [
        {
          text: 'Modifier',
          onPress: () =>
            router.push({
              pathname: '/news-compose',
              params: { editPostId: target.id },
            }),
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const ok = await deletePost(target.id, uid)

            if (ok) {
              router.back()
            } else {
              Alert.alert('Erreur', 'Impossible de supprimer. Réessaie.')
            }
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ])
    },
    [router, uid],
  )

  const share = useCallback((target: NewsPost) => {
    void interactions.onShare(target)
  }, [interactions])

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
            viewer={viewer}
            expanded={expanded}
            onOpenPost={noop}
            onOpenAuthor={openAuthor}
            onOpenOptions={openOptions}
            onOpenMedia={openMedia}
            onOpenComments={openComments}
            onToggleLike={interactions.onToggleLike}
            onToggleSave={interactions.onToggleSave}
            onToggleRepost={interactions.onToggleRepost}
            onShare={share}
            onToggleExpanded={toggleExpanded}
          />
        </ScrollView>

        <NewsCommentsModal
          post={commentPost}
          visible={commentPost !== null}
          onClose={() => setCommentPost(null)}
        />

        <ImageGalleryModal
          visible={galleryIndex !== null}
          media={post.media}
          initialIndex={galleryIndex ?? 0}
          onClose={() => setGalleryIndex(null)}
        />

        <ContentActionsSheet
          visible={!!actionsPost}
          targetType="post"
          targetId={actionsPost?.id ?? ''}
          contentOwnerId={actionsPost?.userId}
          contentOwnerName={actionsPost?.userName}
          onClose={() => setActionsPost(null)}
        />
      </SafeAreaView>
    </PageWrapper>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
