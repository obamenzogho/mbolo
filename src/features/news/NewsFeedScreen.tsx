/* src/features/news/NewsFeedScreen.tsx

   L'écran est le seul propriétaire des overlays : une galerie, une feuille de
   réactions, un menu d'options, une modale de commentaires. Avant, chaque
   PostCard montait sa propre ImageGalleryModal + ReactionPicker : sur un fil
   de 40 posts cela faisait 80 modales dans l'arbre.

   Il couvre aussi les cinq états : squelette, erreur, vide, liste, fin de fil. */

import { useCallback, useMemo, useRef, useState } from 'react'
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
import { auth } from '@/lib/firebase'
import OrbitLoader from '@/components/OrbitLoader'
import { ContentActionsSheet } from '@/components/ContentActionsSheet'
import { deletePost } from './services/postMutations'
import { PostCard } from './components/post/PostCard'
import { NewsFeedSkeleton } from './components/post/PostCardSkeleton'
import NewsCommentsModal from './components/NewsCommentsModal'
import ImageGalleryModal from './components/ImageGalleryModal'
import { ReactionPicker } from './components/ReactionPicker'
import { newsFeedStore } from './store/newsFeedStore'
import { useNewsFeedData } from './hooks/useNewsFeedData'
import { usePostInteractions } from './hooks/usePostInteractions'
import { postColors, postSpacing, postType } from './theme/postTokens'
import type { NewsPost, PostReactionType } from './types'

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

  const {
    posts,
    loading,
    refreshing,
    loadingMore,
    hasMore,
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

  /* ── Overlays, un seul de chaque ─────────────────────────── */
  const [commentPost, setCommentPost] = useState<NewsPost | null>(null)
  const [gallery, setGallery] = useState<GalleryTarget | null>(null)
  const [reactionTarget, setReactionTarget] = useState<NewsPost | null>(null)
  const [actionsPost, setActionsPost] = useState<NewsPost | null>(null)

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
      pathname: '/(tabs)/(sub)/user/[userId]',
      params: { userId },
    })
  }, [])

  const openMedia = useCallback((post: NewsPost, index: number) => {
    setGallery({ media: post.media, index })
  }, [])

  const openComments = useCallback((post: NewsPost) => {
    setCommentPost(post)
  }, [])

  const openReactionList = useCallback((post: NewsPost) => {
    router.push({ pathname: '/post-detail', params: { postId: post.id } })
  }, [])

  const openReactionPicker = useCallback((post: NewsPost) => {
    setReactionTarget(post)
  }, [])

  const selectReaction = useCallback(
    (type: PostReactionType) => {
      if (reactionTarget) interactions.onSelectReaction(reactionTarget, type)
      setReactionTarget(null)
    },
    [interactions, reactionTarget],
  )

  const confirmDelete = useCallback(
    (post: NewsPost) => {
      Alert.alert(
        'Supprimer la publication',
        'Cette action est définitive.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              const ok = await deletePost(post.id, currentUserId)

              if (ok) {
                newsFeedStore.getState().removePost(post.id)
              } else {
                Alert.alert('Erreur', 'Impossible de supprimer. Réessaie.')
              }
            },
          },
        ],
      )
    },
    [currentUserId],
  )

  const editPost = useCallback((post: NewsPost) => {
    router.push({ pathname: '/news-compose', params: { editPostId: post.id } })
  }, [])

  const openOptions = useCallback(
    (post: NewsPost) => {
      if (post.userId !== currentUserId) {
        setActionsPost(post)

        return
      }

      const options = ['Modifier', 'Supprimer', 'Annuler']

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

      Alert.alert('Publication', undefined, [
        { text: options[0], onPress: () => run(0) },
        {
          text: options[1],
          style: 'destructive',
          onPress: () => run(1),
        },
        { text: 'Annuler', style: 'cancel' },
      ])
    },
    [confirmDelete, currentUserId, editPost],
  )

  const keyExtractor = useCallback((item: NewsPost) => item.id, [])

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<NewsPost>) => (
      <PostCard
        post={item}
        currentUserId={currentUserId}
        viewer={interactions.viewerStateFor(item)}
        onOpenPost={openPost}
        onOpenAuthor={openAuthor}
        onOpenOptions={openOptions}
        onOpenMedia={openMedia}
        onOpenComments={openComments}
        onOpenReactionList={openReactionList}
        onOpenReactionPicker={openReactionPicker}
        onToggleReaction={interactions.onToggleReaction}
        onToggleSave={interactions.onToggleSave}
        onToggleRepost={interactions.onToggleRepost}
        onShare={interactions.onShare}
      />
    ),
    [
      currentUserId,
      interactions,
      openAuthor,
      openComments,
      openMedia,
      openOptions,
      openPost,
      openReactionList,
      openReactionPicker,
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
          {error === 'network' ? 'Pas de connexion' : 'Le fil n’a pas pu charger'}
        </Text>
        <Text style={styles.stateText}>
          {error === 'network'
            ? 'Vérifie ta connexion, on réessaie dès que tu es prêt.'
            : 'Un incident est survenu de notre côté.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Réessayer de charger le fil"
          onPress={retry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Réessayer</Text>
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
              <Text style={styles.stateTitle}>Aucune actu pour l’instant</Text>
              <Text style={styles.stateText}>
                Abonne-toi à quelques comptes, leurs publications atterriront ici.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Découvrir des comptes"
                onPress={() => router.push('/explore')}
                style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>Découvrir des comptes</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
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
                Impossible de charger la suite. Réessayer
              </Text>
            </Pressable>
          ) : !hasMore && posts.length > 0 ? (
            <Text style={styles.footerText}>Tu es à jour</Text>
          ) : null
        }
      />

      <ReactionPicker
        visible={!!reactionTarget}
        onSelect={selectReaction}
        onClose={() => setReactionTarget(null)}
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
        onClose={() => setActionsPost(null)}
      />
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
})
