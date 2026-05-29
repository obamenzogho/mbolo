import { useCallback, useRef, useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Keyboard, StyleSheet, Dimensions, FlatList, Pressable, Platform } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '../../../lib/firebase'
import { useComments } from '../../../hooks/useComments'
import { useCommentActions } from '../comments/useCommentActions'
import { CommentItem, type CommentData } from '../comments/CommentItem'
import { CommentInput } from '../comments/CommentInput'
import OrbitLoader from '../../../components/OrbitLoader'
import type { PreviewComment } from '../../../types'

const SCREEN_HEIGHT = Dimensions.get('window').height
const SHEET_SNAP_55 = SCREEN_HEIGHT * 0.55
const SHEET_SNAP_90 = SCREEN_HEIGHT * 0.90

const SPRING_SNAP = { damping: 22, stiffness: 280, mass: 0.6 }
const SPRING_OPEN = { damping: 20, stiffness: 200, mass: 0.5 }

interface CommentSheetProps {
  videoId: string
  videoOwnerId: string
  isOwner: boolean
  previewComments?: PreviewComment[]
  onClose: () => void
  sheetHeight: SharedValue<number>
}

export default function CommentSheet({ videoId, videoOwnerId, isOwner, previewComments, onClose, sheetHeight }: CommentSheetProps) {
  const {
    comments, commentCount: liveCommentCount, repliesData, expandedReplies,
    likeComment: hookLikeComment, likeReply: hookLikeReply,
    deleteComment: hookDeleteComment,
    toggleReplies, loadReplies, currentUser,
  } = useComments(videoId, true, previewComments)

  const { reportComment, addComment, addReply, deleteReply } = useCommentActions(videoId, videoOwnerId)

  const [localReplyingTo, setLocalReplyingTo] = useState<CommentData | null>(null)
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null)
  const [kbHeight, setKbHeight] = useState(0)
  const [loading, setLoading] = useState(true)
  const pendingClose = useRef(false)
  const internalHeight = useSharedValue(0)
  const baseHeight = useSharedValue(0)

  useEffect(() => {
    pendingClose.current = false
    const target = SHEET_SNAP_55
    internalHeight.value = withSpring(target, SPRING_OPEN)
    sheetHeight.value = withSpring(target, SPRING_OPEN)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const timer = setTimeout(() => setLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, (e) => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  useEffect(() => {
    if (!currentUser?.uid) return
    let cancelled = false
    getDoc(doc(db, 'users', currentUser.uid)).then((snap) => {
      if (cancelled || !snap.exists()) return
      const data = snap.data()
      if (typeof data.photoURL === 'string') setCurrentUserPhoto(data.photoURL)
    })
    return () => { cancelled = true }
  }, [currentUser?.uid])

  useEffect(() => {
    setLocalReplyingTo(null)
  }, [videoId])

  const close = useCallback(() => {
    if (pendingClose.current) return
    pendingClose.current = true
    Keyboard.dismiss()
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    internalHeight.value = withSpring(0, { damping: 22, stiffness: 280, mass: 0.6 }, (finished) => {
      if (finished) {
        pendingClose.current = false
        runOnJS(onClose)()
      }
    })
    sheetHeight.value = withSpring(0, { damping: 22, stiffness: 280, mass: 0.6 })
  }, [onClose])

  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onStart(() => {
      'worklet'
      baseHeight.value = internalHeight.value
    })
    .onUpdate((e) => {
      'worklet'
      let newHeight = baseHeight.value - e.translationY
      if (newHeight > SHEET_SNAP_90) {
        newHeight = SHEET_SNAP_90 + Math.sqrt(newHeight - SHEET_SNAP_90) * 0.3
      } else if (newHeight < 0) {
        newHeight = -Math.sqrt(-newHeight) * 0.5
      }
      internalHeight.value = newHeight
      sheetHeight.value = newHeight
    })
    .onEnd((e) => {
      'worklet'
      const currentHeight = internalHeight.value
      const vy = -e.velocityY

      let targetHeight: number
      if (vy > 800) {
        targetHeight = SHEET_SNAP_90
      } else if (vy < -800) {
        targetHeight = 0
      } else {
        const mid55_90 = (SHEET_SNAP_55 + SHEET_SNAP_90) / 2
        const midClose55 = SHEET_SNAP_55 / 2
        if (currentHeight > mid55_90) {
          targetHeight = SHEET_SNAP_90
        } else if (currentHeight > midClose55) {
          targetHeight = SHEET_SNAP_55
        } else {
          targetHeight = 0
        }
      }

      if (targetHeight === 0) {
        runOnJS(close)()
      } else {
        internalHeight.value = withSpring(targetHeight, { damping: 22, stiffness: 280, mass: 0.6, velocity: vy })
        sheetHeight.value = withSpring(targetHeight, { damping: 22, stiffness: 280, mass: 0.6, velocity: vy })
        if (targetHeight === SHEET_SNAP_90) {
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light)
        }
      }
    })

  const sheetAnimStyle = useAnimatedStyle(() => ({
    height: Math.max(0, internalHeight.value),
  }))

  const handleReply = useCallback((commentId: string, username: string) => {
    const found = comments.find((c: CommentData) => c.id === commentId)
    if (found) setLocalReplyingTo(found)
  }, [comments])

  const handleCancelReply = useCallback(() => setLocalReplyingTo(null), [])

  const handlePostComment = useCallback(async (text: string) => {
    await addComment(text)
  }, [addComment])

  const handlePostReply = useCallback(async (commentId: string, text: string, replyToUsername: string | null) => {
    const result = await addReply(commentId, text, replyToUsername)
    if (result) {
      loadReplies(commentId)
      setLocalReplyingTo(null)
    }
  }, [addReply, loadReplies])

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
      repliesExpanded={expandedReplies[item.id] ?? false}
      replies={repliesData[item.id] ?? []}
    />
  ), [videoId, isOwner, currentUser, hookLikeComment, hookDeleteComment, reportComment, handleReply, toggleReplies, hookLikeReply, deleteReply, expandedReplies, repliesData])

  const keyExtractor = useCallback((item: CommentData) => item.id, [])

  const renderEmpty = useCallback(() => (
    loading ? (
      <View style={styles.emptyContainer}>
        <OrbitLoader size={32} />
        <Text style={styles.emptySubtext}>Chargement des commentaires...</Text>
      </View>
    ) : (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubble-ellipses-outline" size={48} color="rgba(255,255,255,0.2)" />
        <Text style={styles.emptyText}>Aucun commentaire pour l'instant</Text>
        <Text style={styles.emptySubtext}>Soyez le premier à commenter</Text>
      </View>
    )
  ), [loading])

  return (
    <Animated.View style={[styles.sheet, sheetAnimStyle, { paddingBottom: kbHeight }]}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.dragArea}>
          <View style={styles.handleBar} />
        </View>
      </GestureDetector>
      <Pressable onPress={Keyboard.dismiss} style={styles.header}>
        <Text style={styles.headerTitle}>
          {liveCommentCount} commentaire{liveCommentCount !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity onPress={close} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#FFF" />
        </TouchableOpacity>
      </Pressable>
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => {
          Keyboard.dismiss()
          return false
        }}
      >
        <FlatList
          data={comments as CommentData[]}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </View>
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
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#121212',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  dragArea: {
    paddingTop: 10,
    paddingBottom: 4,
    alignItems: 'center',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 15,
    fontWeight: '600',
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
})
