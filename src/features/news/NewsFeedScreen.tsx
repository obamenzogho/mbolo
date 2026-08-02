/* src/features/news/NewsFeedScreen.tsx

   L'écran est le seul propriétaire des overlays : une galerie, un menu
   d'options, une modale de commentaires. Avant, chaque PostCard montait sa
   propre modale d'images : sur un fil de 40 posts cela faisait 40 modales
   dans l'arbre.

   Il couvre aussi les cinq états : squelette, erreur, vide, liste, fin de fil. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { auth } from '@/lib/firebase'
import OrbitLoader from '@/components/OrbitLoader'
import { ContentActionsSheet } from '@/components/ContentActionsSheet'
import { useI18n } from '@/i18n'
import { useFollowFast } from '@/hooks/useFollowFast'
import { useFollowAction } from '@/hooks/useFollowAction'
import { deletePost } from './services/postMutations'
import { PostCard } from './components/post/PostCard'
import {
  NewsFeedSkeleton,
  PostCardSkeleton,
} from './components/post/PostCardSkeleton'
import NewsCommentsModal from './components/NewsCommentsModal'
import ImageGalleryModal from './components/ImageGalleryModal'
import { newsFeedStore } from './store/newsFeedStore'
import { useNewsFeedData } from './hooks/useNewsFeedData'
import { usePostInteractions } from './hooks/usePostInteractions'
import { useActiveStories } from './hooks/useActiveStories'
import { postColors, postSpacing, postType } from './theme/postTokens'
import type { NewsPost } from './types'

/** Décalage sous le header d'onglets translucide */
const HEADER_OFFSET = 78

/** Seuil anti-jitter du masquage de header */
const SCROLL_THRESHOLD = 6

interface NewsFeedScreenProps {
  isActive?: boolean
  onScrollDirection?: (direction: 'up' | 'down') => void
}

interface GalleryTarget {
  media: NewsPost['media']
  index: number
}

export default function NewsFeedScreen({
  isActive = true,
  onScrollDirection,
}: NewsFeedScreenProps) {
  const insets = useSafeAreaInsets()
  const currentUserId = auth.currentUser?.uid ?? ''
  const { t } = useI18n()

  const {
    posts,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    streaming,
    error,
    isEmpty,
    loadMore,
    refresh,
    retry,
  } = useNewsFeedData({ store: newsFeedStore, enabled: isActive })

  const interactions = usePostInteractions({
    store: newsFeedStore,
    currentUserId,
  })

  /* ── Anneaux de story : un seul getDocs groupé par page de fil ── */
  const authorIds = useMemo(
    () => Array.from(new Set(posts.map((post) => post.userId))),
    [posts],
  )
  const activeStories = useActiveStories(authorIds)

  /* ── Overlays, un seul de chaque ─────────────────────────── */
  const [commentPost, setCommentPost] = useState<NewsPost | null>(null)
  const [gallery, setGallery] = useState<GalleryTarget | null>(null)
  const [actionsPost, setActionsPost] = useState<NewsPost | null>(null)

  /* ── Légendes dépliées : survit au recyclage des cartes ──── */
  const [expandedPosts, setExpandedPosts] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  const toggleExpanded = useCallback((postId: string) => {
    setExpandedPosts((previous) => {
      const next = new Set(previous)

      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
      }

      return next
    })
  }, [])

  /* ── Toast local (lien copié) ────────────────────────────── */
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }, [])

  /* ── Direction de scroll ─────────────────────────────────── */
  const lastOffset = useRef(0)
  const lastDirection = useRef<'up' | 'down'>('down')

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = Math.max(0, event.nativeEvent.contentOffset.y)

      if (offset <= 8) {
        lastOffset.current = 0

        if (lastDirection.current !== 'down') {
          lastDirection.current = 'down'
          onScrollDirection?.('down')
        }

        return
      }

      const delta = offset - lastOffset.current

      if (Math.abs(delta) < SCROLL_THRESHOLD) return

      const direction = delta > 0 ? 'up' : 'down'

      if (direction !== lastDirection.current) {
        lastDirection.current = direction
        onScrollDirection?.(direction)
      }

      lastOffset.current = offset
    },
    [onScrollDirection],
  )

  /* ── Handlers stables ────────────────────────────────────── */
  const openPost = useCallback((post: NewsPost) => {
    router.push({ pathname: '/post-detail', params: { postId: post.id } })
  }, [])

  const openAuthor = useCallback((userId: string) => {
    router.push({
      pathname: '/user/[userId]',
      params: { userId },
    })
  }, [])

  const openMedia = useCallback((post: NewsPost, index: number) => {
    setGallery({ media: post.media, index })
  }, [])

  const openComments = useCallback((post: NewsPost) => {
    setCommentPost(post)
  }, [])

  const openSharedVideo = useCallback((videoId: string) => {
    router.push({ pathname: '/(tabs)/feed', params: { videoId } })
  }, [])

  const confirmDelete = useCallback(
    (post: NewsPost) => {
      Alert.alert(
        t.news.feed.deleteTitle,
        t.news.feed.deleteMsg,
        [
          { text: t.news.menu.cancel, style: 'cancel' },
          {
            text: t.news.feed.delete,
            style: 'destructive',
            onPress: async () => {
              const ok = await deletePost(post.id, currentUserId)

              if (ok) {
                newsFeedStore.getState().removePost(post.id)
              } else {
                Alert.alert(t.news.feed.error, t.news.feed.deleteFailed)
              }
            },
          },
        ],
      )
    },
    [currentUserId, t],
  )

  const editPost = useCallback((post: NewsPost) => {
    router.push({ pathname: '/create', params: { editPostId: post.id } })
  }, [])

  const openOptions = useCallback(
    (post: NewsPost) => {
      if (post.userId !== currentUserId) {
        setActionsPost(post)

        return
      }

      const options = [t.news.feed.edit, t.news.feed.delete, t.news.menu.cancel]

      const run = (index: number) => {
        if (index === 0) editPost(post)
        if (index === 1) confirmDelete(post)
      }

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            destructiveButtonIndex: 1,
            cancelButtonIndex: 2,
          },
          run,
        )

        return
      }

      Alert.alert(t.news.feed.menuTitle, undefined, [
        { text: options[0], onPress: () => run(0) },
        {
          text: options[1],
          style: 'destructive',
          onPress: () => run(1),
        },
        { text: t.news.menu.cancel, style: 'cancel' },
      ])
    },
    [confirmDelete, currentUserId, editPost, t],
  )

  /* ── Menu enrichi (copier le lien, sauvegarder, ne plus suivre) ── */
  const sheetAuthorId = actionsPost?.userId ?? ''
  const { isFollowing: sheetIsFollowing } = useFollowFast(sheetAuthorId)
  const { toggleFollow } = useFollowAction()
  const sheetSaved = actionsPost
    ? interactions.viewerStateFor(actionsPost).saved
    : false

  const copyPostLink = useCallback(() => {
    if (!actionsPost) return
    void Clipboard.setStringAsync(`https://mbolo.app/post/${actionsPost.id}`)
    showToast(t.news.menu.linkCopied)
  }, [actionsPost, showToast, t])

  const toggleSheetSave = useCallback(() => {
    if (actionsPost) interactions.onToggleSave(actionsPost)
  }, [actionsPost, interactions])

  const toggleSheetFollow = useCallback(() => {
    if (sheetAuthorId) void toggleFollow(sheetAuthorId)
  }, [sheetAuthorId, toggleFollow])

  const keyExtractor = useCallback((item: NewsPost) => item.id, [])

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<NewsPost>) => (
      <PostCard
        post={item}
        currentUserId={currentUserId}
        viewer={interactions.viewerStateFor(item)}
        hasStory={activeStories.has(item.userId)}
        expanded={expandedPosts.has(item.id)}
        onOpenPost={openPost}
        onOpenAuthor={openAuthor}
        onOpenOptions={openOptions}
        onOpenMedia={openMedia}
        onOpenComments={openComments}
        onOpenSharedVideo={openSharedVideo}
        onToggleLike={interactions.onToggleLike}
        onToggleSave={interactions.onToggleSave}
        onToggleRepost={interactions.onToggleRepost}
        onShare={interactions.onShare}
        onToggleExpanded={toggleExpanded}
      />
    ),
    [
      activeStories,
      currentUserId,
      expandedPosts,
      interactions,
      openAuthor,
      openComments,
      openMedia,
      openOptions,
      openPost,
      openSharedVideo,
      toggleExpanded,
    ],
  )

  const contentContainerStyle = useMemo(
    () => ({
      paddingTop: insets.top + HEADER_OFFSET,
      paddingBottom: 32,
      flexGrow: 1,
    }),
    [insets.top],
  )

  /* ── Premier chargement ──────────────────────────────────── */
  if (loading && posts.length === 0 && !error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + HEADER_OFFSET }]}>
        <NewsFeedSkeleton />
      </View>
    )
  }

  /* ── Échec sur fil vide ──────────────────────────────────── */
  if (error && posts.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons
          name={error === 'network' ? 'cloud-offline-outline' : 'alert-circle-outline'}
          size={34}
          color={postColors.textTertiary}
        />
        <Text style={styles.stateTitle}>
          {error === 'network' ? t.news.feed.noConnection : t.news.feed.loadFailed}
        </Text>
        <Text style={styles.stateText}>
          {error === 'network'
            ? t.news.feed.offlineDesc
            : t.news.feed.incidentDesc}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.news.feed.retryA11y}
          onPress={retry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>{t.news.feed.retry}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={contentContainerStyle}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={60}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={postColors.accent}
            colors={[postColors.accent]}
            progressViewOffset={insets.top + HEADER_OFFSET}
          />
        }
        ListEmptyComponent={
          isEmpty ? (
            <View style={styles.centered}>
              <Ionicons
                name="newspaper-outline"
                size={34}
                color={postColors.textTertiary}
              />
              <Text style={styles.stateTitle}>{t.news.feed.empty}</Text>
              <Text style={styles.stateText}>
                {t.news.feed.emptyDesc}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.news.feed.discover}
                onPress={() => router.push('/explore')}
                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>{t.news.feed.discover}</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListFooterComponent={
          streaming ? (
            /* Affichage progressif façon Facebook : pendant que les
               derniers posts de la page affluent, des placeholders
               apparaissent sous les posts déjà présents. */
            <View style={styles.footer}>
              <PostCardSkeleton withMedia />
              <PostCardSkeleton withMedia={false} />
            </View>
          ) : loadingMore ? (
            <View style={styles.footer}>
              <OrbitLoader />
            </View>
          ) : error ? (
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={({ pressed }) => [styles.footer, pressed && styles.pressed]}
            >
              <Text style={styles.footerLink}>
                {t.news.feed.loadMoreFailed}
              </Text>
            </Pressable>
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.footerText}>{t.news.feed.upToDate}</Text>
          ) : null
        }
      />

      <ImageGalleryModal
        visible={!!gallery}
        media={gallery?.media ?? []}
        initialIndex={gallery?.index ?? 0}
        onClose={() => setGallery(null)}
      />

      <NewsCommentsModal
        post={commentPost}
        visible={commentPost !== null}
        onClose={() => setCommentPost(null)}
      />

      <ContentActionsSheet
        visible={!!actionsPost}
        targetType="post"
        targetId={actionsPost?.id ?? ''}
        contentOwnerId={actionsPost?.userId}
        contentOwnerName={actionsPost?.userName}
        isFollowing={sheetIsFollowing}
        onToggleFollow={toggleSheetFollow}
        isSaved={sheetSaved}
        onToggleSave={toggleSheetSave}
        onCopyLink={copyPostLink}
        onClose={() => setActionsPost(null)}
      />

      {toast ? (
        <View
          pointerEvents="none"
          style={[styles.toast, { bottom: insets.bottom + 88 }]}
        >
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: postColors.canvas,
  },
  centered: {
    flex: 1,
    minHeight: 380,
    alignItems: 'center',
    justifyContent: 'center',
    gap: postSpacing.rowGap,
    paddingHorizontal: 36,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: postColors.textPrimary,
    marginTop: 4,
  },
  stateText: {
    ...postType.body,
    fontSize: 14,
    color: postColors.textSecondary,
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: postColors.accentSoft,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
    color: postColors.accent,
  },
  pressed: {
    opacity: 0.62,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  footerText: {
    ...postType.stat,
    color: postColors.textTertiary,
    textAlign: 'center',
    paddingVertical: 22,
  },
  footerLink: {
    ...postType.link,
    color: postColors.accent,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '80%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(8, 9, 10, 0.92)',
  },
  toastText: {
    color: postColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
})
