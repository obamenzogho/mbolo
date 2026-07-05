/* CommentSheet — bottom sheet commentaires style Instagram. */

import { useCallback, useRef, useState, useEffect, useMemo } from 'react'
import { View, Text, TouchableOpacity, Keyboard, Pressable, StyleSheet } from 'react-native'
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import BottomSheet, { BottomSheetFlatList, BottomSheetBackdrop } from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { useComments } from '../../../hooks/useComments'
import { CommentItem, type CommentData } from '../comments/CommentItem'
import { CommentInput } from '../comments/CommentInput'
import OrbitLoader from '../../../components/OrbitLoader'
import type { PreviewComment } from '../../../types'
import { colors } from '../../../lib/theme'

type SortMode = 'top' | 'new'

interface CommentSheetProps {
  videoId: string
  videoOwnerId: string
  isOwner: boolean
  previewComments?: PreviewComment[]
  onClose: () => void
  sheetRef: React.RefObject<BottomSheet | null>
}

function formatCommentCount(n: number): string {
  if (n >= 1000) return n.toLocaleString('fr-FR')
  return String(n)
}

export default function CommentSheet({ videoId, videoOwnerId, isOwner, previewComments, onClose, sheetRef }: CommentSheetProps) {
  const {
    comments, commentCount: liveCommentCount, repliesData, expandedReplies,
    hasMoreComments, loadingMore, hasMoreReplies, loadingMoreReplies,
    likeComment: hookLikeComment, likeReply: hookLikeReply,
    deleteComment: hookDeleteComment,
    toggleReplies, currentUser,
    addComment, addReply, reportComment, deleteReply,
    loadMoreComments, loadMoreReplies,
  } = useComments(videoId, true, previewComments, videoOwnerId)

  const [localReplyingTo, setLocalReplyingTo] = useState<CommentData | null>(null)
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>('top')

  const snapPoints = useMemo(() => ['50%', '92%'], [])

  const insets = useSafeAreaInsets()
  const keyboard = useAnimatedKeyboard()
  const inputBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboard.height.value }],
  }))

  const sortedComments = useMemo(() => {
    const arr = [...(comments as CommentData[])]
    if (sortMode === 'top') {
      arr.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    } else {
      arr.sort((a, b) => {
        const toMs = (v: unknown): number => {
          if (!v) return 0
          const d = (v as { toDate?: () => Date }).toDate ? (v as { toDate: () => Date }).toDate() : new Date(v as string | number)
          return isNaN(d.getTime()) ? 0 : d.getTime()
        }
        return toMs(b.createdAt) - toMs(a.createdAt)
      })
    }
    return arr
  }, [comments, sortMode])

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [videoId])

  useEffect(() => {
    if (!currentUser?.uid) return
    if (currentUser.photoURL) {
      setCurrentUserPhoto(currentUser.photoURL)
      return
    }
    let cancelled = false
    getDoc(doc(db, 'users', currentUser.uid)).then((snap) => {
      if (cancelled || !snap.exists()) return
      const data = snap.data()
      if (typeof data.photoURL === 'string') setCurrentUserPhoto(data.photoURL)
    })
    return () => { cancelled = true }
  }, [currentUser?.uid, currentUser?.photoURL])

  useEffect(() => {
    setLocalReplyingTo(null)
  }, [videoId])

  const handleClose = useCallback(() => {
    Keyboard.dismiss()
    sheetRef.current?.close()
  }, [sheetRef])

  const [sheetOpen, setSheetOpen] = useState(false)

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      setSheetOpen(false)
      onClose()
    } else {
      setSheetOpen(true)
    }
  }, [onClose])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="none"
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (Keyboard.isVisible()) {
              Keyboard.dismiss()
            } else {
              sheetRef.current?.close()
            }
          }}
        />
      </BottomSheetBackdrop>
    ),
    [sheetRef],
  )

  const handleReply = useCallback((commentId: string, _username: string) => {
    const found = comments.find((c: CommentData) => c.id === commentId)
    if (found) setLocalReplyingTo(found)
  }, [comments])

  const handleCancelReply = useCallback(() => setLocalReplyingTo(null), [])

  const handlePostComment = useCallback(async (text: string) => {
    await addComment(text)
  }, [addComment])

  const handlePostReply = useCallback(async (commentId: string, text: string, replyToUsername: string | null) => {
    const result = await addReply(commentId, text, replyToUsername)
    if (result) setLocalReplyingTo(null)
  }, [addReply])

  const renderItem = useCallback(({ item }: { item: CommentData }) => (
    <CommentItem
      comment={item}
      videoId={videoId}
      isVideoOwner={isOwner}
      currentUserId={currentUser?.uid}
      onLike={(commentId, liked) => hookLikeComment(commentId, liked)}
      onDelete={(commentId) => hookDeleteComment(commentId)}
      onReport={(commentId) => reportComment(commentId)}
      onReply={handleReply}
      onToggleReplies={toggleReplies}
      onReplyLike={(commentId, replyId, liked) => hookLikeReply(commentId, replyId, liked)}
      onReplyDelete={(commentId, replyId) => deleteReply(commentId, replyId)}
      onLoadMoreReplies={loadMoreReplies}
      repliesExpanded={expandedReplies[item.id] ?? false}
      replies={repliesData[item.id] ?? []}
      hasMoreReplies={hasMoreReplies[item.id] ?? false}
      isLoadingMoreReplies={loadingMoreReplies[item.id] ?? false}
    />
  ), [videoId, isOwner, currentUser, hookLikeComment, hookDeleteComment, reportComment, handleReply, toggleReplies, hookLikeReply, deleteReply, loadMoreReplies, expandedReplies, repliesData, hasMoreReplies, loadingMoreReplies])

  const keyExtractor = useCallback((item: CommentData) => item.id, [])

  const renderFooter = useCallback(() => (
    <>
      {loadingMore && (
        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
          <OrbitLoader size={24} />
        </View>
      )}
      {!hasMoreComments && sortedComments.length > 0 && (
        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
          <Text style={styles.endOfListText}>— Fin des commentaires —</Text>
        </View>
      )}
    </>
  ), [loadingMore, hasMoreComments, sortedComments.length])

  const renderInputBar = useCallback(() => (
    <View style={styles.inputBar}>
      <CommentInput
        videoId={videoId}
        replyingTo={localReplyingTo}
        currentUserPhotoURL={currentUserPhoto ?? currentUser?.photoURL}
        currentUserDisplayName={currentUser?.displayName}
        onCancelReply={handleCancelReply}
        onPostComment={handlePostComment}
        onPostReply={handlePostReply}
      />
    </View>
  ), [videoId, localReplyingTo, currentUserPhoto, currentUser, handleCancelReply, handlePostComment, handlePostReply])

  const renderEmpty = useCallback(() => (
    loading ? (
      <View style={styles.emptyContainer}>
        <OrbitLoader size={32} />
        <Text style={styles.emptySubtext}>Chargement...</Text>
      </View>
    ) : (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textFaint} />
        <Text style={styles.emptyText}>Aucun commentaire</Text>
        <Text style={styles.emptySubtext}>Soyez le premier à commenter</Text>
      </View>
    )
  ), [loading])

  return (
    <>
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handleBar}
      keyboardBehavior="none"
      keyboardBlurBehavior="restore"
      onChange={handleSheetChange}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Commentaires</Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.sortTabs}>
        <TouchableOpacity
          style={[styles.sortTab, sortMode === 'top' && styles.sortTabActive]}
          onPress={() => setSortMode('top')}
        >
          <Text style={[styles.sortTabText, sortMode === 'top' && styles.sortTabTextActive]}>Top</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortTab, sortMode === 'new' && styles.sortTabActive]}
          onPress={() => setSortMode('new')}
        >
          <Text style={[styles.sortTabText, sortMode === 'new' && styles.sortTabTextActive]}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {sortedComments.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textFaint} />
          <Text style={styles.emptyText}>Aucun commentaire</Text>
          <Text style={styles.emptySubtext}>Soyez le premier à commenter</Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={sortedComments}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="never"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreComments}
          onEndReachedThreshold={0.5}
        />
      )}
    </BottomSheet>

    {sheetOpen && (
    <Animated.View
      style={[styles.inputBarOverlay, { bottom: insets.bottom }, inputBarStyle]}
      pointerEvents="box-none"
    >
      <CommentInput
        videoId={videoId}
        replyingTo={localReplyingTo}
        currentUserPhotoURL={currentUserPhoto ?? currentUser?.photoURL}
        currentUserDisplayName={currentUser?.displayName}
        onCancelReply={handleCancelReply}
        onPostComment={handlePostComment}
        onPostReply={handlePostReply}
      />
    </Animated.View>
    )}
    </>
  )
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
  },
  handleIndicator: {
    backgroundColor: colors.progress,
    width: 36,
  },
  handleBar: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.hairline,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  sortTab: {
    paddingVertical: 4,
  },
  sortTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.progress,
  },
  sortTabText: {
    color: colors.textFaint,
    fontSize: 14,
    fontWeight: '600',
  },
  sortTabTextActive: {
    color: colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 60,
    gap: 8,
  },
  emptyText: {
    color: colors.textFaint,
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 13,
  },
  endOfListText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  inputBar: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  inputBarOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingBottom: 8,
    zIndex: 10,
  },
})
