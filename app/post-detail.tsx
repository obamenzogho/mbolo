import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { colors } from '@/lib/theme'
import { PostCard } from '@/features/news/components/PostCard'
import NewsCommentsModal from '@/features/news/components/NewsCommentsModal'
import { useNewsFeed } from '@/features/news/hooks/useNewsFeed'
import { BackButton } from '@/components/ui/BackButton'
import type { NewsPost } from '@/features/news/types'

function toDate(value: any): Date {
  if (!value) return new Date()
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  return new Date(value)
}

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>()
  const uid = auth.currentUser?.uid ?? ''
  const [post, setPost] = useState<NewsPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentPost, setCommentPost] = useState<NewsPost | null>(null)

  const { toggleLike, toggleSave, registerShare, deletePost } = useNewsFeed()

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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <BackButton />

      <ScrollView>
        <PostCard
          post={post}
          currentUserId={uid}
          onLike={(id) => {
            toggleLike(id)
            setPost((p) => p ? {
              ...p,
              likes: p.likedBy.includes(uid)
                ? Math.max(0, p.likes - 1) : p.likes + 1,
              likedBy: p.likedBy.includes(uid)
                ? p.likedBy.filter((i) => i !== uid)
                : [...p.likedBy, uid],
            } : p)
          }}
          onSave={(id) => {
            toggleSave(id)
            setPost((p) => p ? {
              ...p,
              saves: p.savedBy.includes(uid)
                ? Math.max(0, p.saves - 1) : p.saves + 1,
              savedBy: p.savedBy.includes(uid)
                ? p.savedBy.filter((i) => i !== uid)
                : [...p.savedBy, uid],
            } : p)
          }}
          onShare={registerShare}
          onComment={setCommentPost}
          onEdit={() => {}}
          onDelete={() => {}}
          onMore={() => {}}
        />
      </ScrollView>

      <NewsCommentsModal
        post={commentPost}
        visible={commentPost !== null}
        onClose={() => setCommentPost(null)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
