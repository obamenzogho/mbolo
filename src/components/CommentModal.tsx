import { useRef, useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Dimensions, Keyboard, Alert, Modal, StyleSheet,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedKeyboard,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { captureException } from '../lib/sentry'
import { colors } from '../lib/theme'
import { Avatar } from './ui/Avatar'
import { formatCount, formatTime, useComments } from '../hooks/useComments'
import { router } from 'expo-router'

const SCREEN_HEIGHT = Dimensions.get('window').height
const INPUT_BAR_HEIGHT = 64

function UserAvatar({ uri, name, size, userId }: { uri?: string; name?: string; size: number; userId?: string }) {
  return (
    <Avatar
      uri={uri}
      name={name}
      size={size}
      onPress={userId ? () => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId } }) : undefined}
    />
  )
}

function ReplyRow({ reply, commentId, onLike, onDislike, onReply, onDelete, isOwner, currentUserId }: {
  reply: any; commentId: string; onLike: (liked: boolean) => void; onDislike: (disliked: boolean) => void; onReply: () => void; onDelete: () => void; isOwner: boolean; currentUserId?: string
}) {
  const avatarUri = reply.authorPhoto || reply.avatarUrl
  const avatarName = reply.authorName || reply.username
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(reply.likes || 0)
  const [disliked, setDisliked] = useState(false)
  const [dislikes, setDislikes] = useState(reply.dislikes || 0)

  useEffect(() => {
    if (currentUserId && reply.likedBy?.includes(currentUserId)) setLiked(true)
    else setLiked(false)
  }, [reply.likedBy, currentUserId])

  useEffect(() => {
    if (currentUserId && reply.dislikedBy?.includes(currentUserId)) setDisliked(true)
    else setDisliked(false)
  }, [reply.dislikedBy, currentUserId])

  const handleLike = () => {
    const next = !liked; setLiked(next); setLikes((p: number) => next ? p + 1 : p - 1)
    if (disliked) { setDisliked(false); setDislikes((p: number) => p - 1) }
    onLike(next)
  }

  const handleDislike = () => {
    const next = !disliked; setDisliked(next); setDislikes((p: number) => next ? p + 1 : p - 1)
    if (liked) { setLiked(false); setLikes((p: number) => p - 1) }
    onDislike(next)
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={() => { if (isOwner) onDelete() }}
      style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}
    >
      <UserAvatar uri={avatarUri} name={avatarName} size={36} userId={reply.userId} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 14, color: colors.white, marginBottom: 1 }}>
          {reply.authorName || reply.username || 'Utilisateur'}
        </Text>
        <Text style={{ fontSize: 14, color: colors.white, lineHeight: 18, marginBottom: 4 }}>
          {reply.replyToUsername && (
            <Text style={{ color: '#00A86B' }}>@{reply.replyToUsername} </Text>
          )}
          {reply.text}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 12, color: '#888' }}>
            {formatTime(reply.createdAt)}
          </Text>
          <TouchableOpacity onPress={onReply}>
            <Text style={{ fontSize: 12, color: '#888', fontWeight: '600' }}>Répondre</Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={onDelete}>
              <Text style={{ fontSize: 12, color: colors.error, fontWeight: '600' }}>Supprimer</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color={liked ? '#FCD116' : '#888'} />
            <Text style={{ fontSize: 11, color: '#888' }}>{formatCount(likes)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDislike} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Ionicons name={disliked ? 'heart-dislike' : 'heart-dislike-outline'} size={14} color={disliked ? '#FCD116' : '#888'} />
            <Text style={{ fontSize: 11, color: '#888' }}>{formatCount(dislikes)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function CommentRow({ comment, videoId, currentUserId, onReply, onLike, onDislike, onToggleReplies, expanded, replies, onLikeReply, onDislikeReply, onDelete, onDeleteReply, isOwner }: {
  comment: any; videoId: string; currentUserId?: string; onReply: () => void
  onLike: (liked: boolean) => void; onDislike: (disliked: boolean) => void; onToggleReplies: () => void; expanded: boolean; replies: any[]
  onLikeReply: (commentId: string, replyId: string, liked: boolean) => void
  onDislikeReply: (commentId: string, replyId: string, disliked: boolean) => void
  onDelete: () => void; onDeleteReply: (replyId: string) => void; isOwner: boolean
}) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(comment.likes || 0)
  const [disliked, setDisliked] = useState(false)
  const [dislikes, setDislikes] = useState(comment.dislikes || 0)

  useEffect(() => {
    if (currentUserId && comment.likedBy?.includes(currentUserId)) setLiked(true)
    else setLiked(false)
  }, [comment.likedBy, currentUserId])

  useEffect(() => {
    if (currentUserId && comment.dislikedBy?.includes(currentUserId)) setDisliked(true)
    else setDisliked(false)
  }, [comment.dislikedBy, currentUserId])

  useEffect(() => { setLikes(comment.likes || 0) }, [comment.likes])
  useEffect(() => { setDislikes(comment.dislikes || 0) }, [comment.dislikes])

  const handleLike = () => {
    const next = !liked; setLiked(next); setLikes((p: number) => next ? p + 1 : p - 1)
    if (disliked) { setDisliked(false); setDislikes((p: number) => p - 1) }
    onLike(next)
  }

  const handleDislike = () => {
    const next = !disliked; setDisliked(next); setDislikes((p: number) => next ? p + 1 : p - 1)
    if (liked) { setLiked(false); setLikes((p: number) => p - 1) }
    onDislike(next)
  }

  const replyCount = comment.replyCount || 0

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={() => { if (isOwner) onDelete() }}
      style={{ paddingHorizontal: 16, marginBottom: 20 }}
    >
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <UserAvatar uri={comment.authorPhoto} name={comment.authorName} size={40} userId={comment.userId} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 15, color: colors.white, marginBottom: 2 }}>
            {comment.authorName || 'Utilisateur'}
          </Text>
          <Text style={{ fontSize: 15, color: colors.white, lineHeight: 20, marginBottom: 6 }}>
            {comment.text}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 13, color: '#888' }}>
              {formatTime(comment.createdAt)}
            </Text>
            <TouchableOpacity onPress={onReply}>
              <Text style={{ fontSize: 13, color: '#888', fontWeight: '600' }}>Répondre</Text>
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity onPress={onDelete}>
                <Text style={{ fontSize: 13, color: colors.error, fontWeight: '600' }}>Supprimer</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={handleLike} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? '#FCD116' : '#888'} />
              <Text style={{ fontSize: 12, color: '#888' }}>{formatCount(likes)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDislike} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name={disliked ? 'heart-dislike' : 'heart-dislike-outline'} size={16} color={disliked ? '#FCD116' : '#888'} />
              <Text style={{ fontSize: 12, color: '#888' }}>{formatCount(dislikes)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {(replyCount > 0 || replies.length > 0) && (
        <TouchableOpacity
          onPress={onToggleReplies}
          style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 50, marginTop: 6 }}
        >
          <Text style={{ color: '#888', fontSize: 13 }}>— </Text>
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600' }}>
            {expanded ? 'Masquer' : 'Afficher'} {replyCount} réponse{replyCount > 1 ? 's' : ''}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#888" style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      )}
      {expanded && replies.map((reply: any) => (
        <View key={reply.id} style={{ marginLeft: 50, marginTop: 12 }}>
          <ReplyRow
            reply={reply}
            commentId={comment.id}
            currentUserId={currentUserId}
            onLike={(liked) => onLikeReply(comment.id, reply.id, liked)}
            onDislike={(disliked) => onDislikeReply(comment.id, reply.id, disliked)}
            onReply={onReply}
            onDelete={() => onDeleteReply(reply.id)}
            isOwner={isOwner}
          />
        </View>
      ))}
    </TouchableOpacity>
  )
}

export default function CommentModal({
  visible, onClose, videoId,
}: {
  visible: boolean; onClose: () => void; videoId: string
}) {
  const [userAvatar, setUserAvatar] = useState('')
  const [userName, setUserName] = useState('')
  const translateY = useSharedValue(SCREEN_HEIGHT)
  const backdropOpacity = useSharedValue(0)
  const keyboard = useAnimatedKeyboard()
  const [showInputOverlay, setShowInputOverlay] = useState(false)
  const overlayOpacity = useSharedValue(0)
  const overlayInputRef = useRef<TextInput>(null)
  const showOverlayRef = useRef(false)
  const modalContainerRef = useRef<View>(null)
  const bottomInset = useSharedValue(0)

  const {
    comments, commentCount, commentsEnabled, hasMoreComments, repliesData, expandedReplies,
    inputText, replyingTo, sending, currentUser,
    setInputText, sendComment, cancelCurrentReply,
    startReply, likeComment, likeReply, dislikeComment, dislikeReply, toggleReplies,
    deleteComment, deleteReply,
  } = useComments(videoId, visible)

  useEffect(() => {
    if (!currentUser) return
    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid))
        if (snap.exists()) {
          setUserAvatar(snap.data().photoURL || '')
          setUserName(snap.data().nom || '')
        }
      } catch (e) { console.warn('fetchUser error:', e) }
    }
    fetchUser()
  }, [currentUser])

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) })
      translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) })
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250, easing: Easing.out(Easing.cubic) })
      Keyboard.dismiss()
    }
  }, [visible, translateY, backdropOpacity])

  const handleOpenInput = useCallback(() => {
    showOverlayRef.current = true
    setShowInputOverlay(true)
    overlayOpacity.value = withTiming(1, { duration: 150 })
    setTimeout(() => overlayInputRef.current?.focus(), 300)
  }, [overlayOpacity])

  const handleSendOverlay = useCallback(async () => {
    await sendComment()
    Keyboard.dismiss()
  }, [sendComment])

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (showOverlayRef.current) {
        overlayOpacity.value = 0
        setShowInputOverlay(false)
        showOverlayRef.current = false
        cancelCurrentReply()
      }
    })
    return () => sub.remove()
  }, [cancelCurrentReply, overlayOpacity])

  const handleReply = useCallback((commentId: string, username: string) => {
    startReply(commentId, username)
    handleOpenInput()
  }, [startReply, handleOpenInput])

  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY)
    })
    .onEnd((e) => {
      if (e.translationY > 150 || e.velocityY > 500) {
        runOnJS(onClose)()
      } else {
        translateY.value = withSpring(0, { damping: 40, stiffness: 300 })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.8,
    transform: [{ translateY: translateY.value }],
  }))

  useEffect(() => {
    if (visible && modalContainerRef.current) {
      modalContainerRef.current.measureInWindow((_x, _y, _w, h) => {
        bottomInset.value = SCREEN_HEIGHT - _y - h
      })
    }
  }, [visible, bottomInset])

  const inputOverlayStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Math.max(0, keyboard.height.value - bottomInset.value),
    opacity: overlayOpacity.value,
  }))

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View ref={modalContainerRef} style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdropOpacity }]}
        />
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#111111',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              },
              sheetStyle,
            ]}
          >
            <View style={{ alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
              <View style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: '#444', marginBottom: 8 }} />
              <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                <View style={{ width: 28 }} />
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#888' }}>
                  {commentCount} commentaire{commentCount !== 1 ? 's' : ''}
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>
            </View>
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <CommentRow
                  comment={item}
                  videoId={videoId}
                  currentUserId={currentUser?.uid}
                  onReply={() => handleReply(item.id, item.authorName || 'Utilisateur')}
                  onLike={(liked) => likeComment(item.id, liked)}
                  onDislike={(disliked) => dislikeComment(item.id, disliked)}
                  onToggleReplies={() => toggleReplies(item.id)}
                  expanded={!!expandedReplies[item.id]}
                  replies={repliesData[item.id] || []}
                  onLikeReply={(cid, rid, liked) => likeReply(cid, rid, liked)}
                  onDislikeReply={(cid, rid, disliked) => dislikeReply(cid, rid, disliked)}
                  onDelete={() => {
                    Alert.alert('Supprimer', 'Supprimer ce commentaire ?', [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Supprimer', style: 'destructive', onPress: () => deleteComment(item.id) },
                    ])
                  }}
                  onDeleteReply={(replyId: string) => {
                    Alert.alert('Supprimer', 'Supprimer cette réponse ?', [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Supprimer', style: 'destructive', onPress: () => deleteReply(item.id, replyId) },
                    ])
                  }}
                  isOwner={item.userId === currentUser?.uid}
                />
              )}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: INPUT_BAR_HEIGHT }}
              ListEmptyComponent={
                videoId.startsWith('demo-') ? null : (
                  <View style={{ alignItems: 'center', marginTop: 60 }}>
                    <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textSecondary} />
                    <Text style={{ color: '#888', fontSize: 15, marginTop: 12 }}>
                      Aucun commentaire pour le moment
                    </Text>
                    <Text style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                      Sois le premier à commenter !
                    </Text>
                  </View>
                )
              }
            />
            {visible && !videoId.startsWith('demo-') && (
              <View style={{ borderTopWidth: 0.5, borderTopColor: '#222' }}>
                <TouchableOpacity
                  onPress={handleOpenInput}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}
                >
                  <UserAvatar uri={userAvatar} name={userName} size={40} />
                  <View style={{
                    flex: 1, backgroundColor: '#222', borderRadius: 24,
                    paddingHorizontal: 14, paddingVertical: 10,
                  }}>
                    {!commentsEnabled ? (
                      <Text style={{ color: '#666', fontSize: 14 }}>Les commentaires sont désactivés</Text>
                    ) : replyingTo ? (
                      <Text style={{ color: '#888', fontSize: 13 }}>
                        Réponse à{' '}
                        <Text style={{ color: '#00A86B' }}>@{replyingTo.username}</Text>
                      </Text>
                    ) : (
                      <Text style={{ color: '#666', fontSize: 14 }}>Ajouter un commentaire...</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </GestureDetector>
        {showInputOverlay && (
          <Animated.View style={[inputOverlayStyle, {
            backgroundColor: '#111111', borderTopWidth: 0.5, borderTopColor: '#222',
            zIndex: 30,
          }]}>
            {replyingTo && (
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#222',
              }}>
                <Text style={{ color: '#888', fontSize: 13 }}>
                  Réponse à{' '}
                  <Text style={{ color: '#00A86B' }}>@{replyingTo.username}</Text>
                </Text>
                <TouchableOpacity onPress={() => { cancelCurrentReply(); setInputText('') }}>
                  <Text style={{ color: '#888', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
              <UserAvatar uri={userAvatar} name={userName} size={40} />
              <View style={{
                flex: 1, flexDirection: 'row', alignItems: 'center',
                backgroundColor: '#2a2a2a', borderRadius: 24, paddingHorizontal: 14,
              }}>
                <TextInput
                  ref={overlayInputRef}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={replyingTo ? `Réponse à @${replyingTo.username}` : 'Ajouter un commentaire...'}
                  placeholderTextColor="#666"
                  style={{ flex: 1, paddingVertical: 8, color: 'white', fontSize: 14, maxHeight: 80 }}
                  multiline
                  autoFocus
                />
                {inputText.trim().length > 0 && (
                  <TouchableOpacity
                    onPress={handleSendOverlay}
                    disabled={sending}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="send" size={20} color="#00A86B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  )
}
