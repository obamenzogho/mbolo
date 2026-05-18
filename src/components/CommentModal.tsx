import { useRef, useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Platform, Image, Dimensions, Keyboard,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { colors } from '../lib/theme'
import { formatCount, formatTime, useComments } from '../hooks/useComments'
import { router } from 'expo-router'

const SCREEN_HEIGHT = Dimensions.get('window').height

function Avatar({ uri, name, size, userId }: { uri?: string; name?: string; size: number; userId?: string }) {
  return (
    <TouchableOpacity
      onPress={() => { if (userId) router.push({ pathname: '/(tabs)/user/[userId]', params: { userId } }) }}
      activeOpacity={0.7}
    >
      <Image
        source={{
          uri: uri || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=00A86B&color=fff&size=${size * 2}`,
        }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    </TouchableOpacity>
  )
}

function ReplyRow({ reply, commentId, onLike, onDislike, onReply }: {
  reply: any; commentId: string; onLike: () => void; onDislike: () => void; onReply: () => void
}) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(reply.likes || 0)
  const [disliked, setDisliked] = useState(false)
  const [dislikes, setDislikes] = useState(reply.dislikes || 0)

  const handleLike = () => {
    setLiked(!liked); setLikes((p: number) => liked ? p - 1 : p + 1)
    onLike()
  }

  const handleDislike = () => {
    setDisliked(!disliked); setDislikes((p: number) => disliked ? p - 1 : p + 1)
    onDislike()
  }

  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
      <Avatar uri={reply.authorPhoto || reply.avatarUrl} name={reply.authorName || reply.username} size={36} userId={reply.userId} />
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
    </View>
  )
}

function CommentRow({ comment, videoId, currentUserId, onReply, onLike, onDislike, onToggleReplies, expanded, replies, onLikeReply, onDislikeReply }: {
  comment: any; videoId: string; currentUserId?: string; onReply: () => void
  onLike: () => void; onDislike: () => void; onToggleReplies: () => void; expanded: boolean; replies: any[]
  onLikeReply: (commentId: string, replyId: string, likedByArr: string[]) => void
  onDislikeReply: (commentId: string, replyId: string, dislikedByArr: string[]) => void
}) {
  const [liked, setLiked] = useState(false)
  const [likes, setLikes] = useState(comment.likes || 0)
  const [disliked, setDisliked] = useState(false)
  const [dislikes, setDislikes] = useState(comment.dislikes || 0)

  useEffect(() => {
    if (currentUserId && comment.likedBy?.includes(currentUserId)) setLiked(true)
  }, [comment.likedBy, currentUserId])

  useEffect(() => {
    if (currentUserId && comment.dislikedBy?.includes(currentUserId)) setDisliked(true)
  }, [comment.dislikedBy, currentUserId])

  const handleLike = () => {
    setLiked(!liked); setLikes((p: number) => liked ? Math.max(0, p - 1) : p + 1)
    onLike()
  }

  const handleDislike = () => {
    setDisliked(!disliked); setDislikes((p: number) => disliked ? Math.max(0, p - 1) : p + 1)
    onDislike()
  }

  const replyCount = comment.replyCount || 0

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Avatar uri={comment.authorPhoto} name={comment.authorName} size={40} userId={comment.userId} />
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
            onLike={() => onLikeReply(comment.id, reply.id, reply.likedBy || [])}
            onDislike={() => onDislikeReply(comment.id, reply.id, reply.dislikedBy || [])}
            onReply={onReply}
          />
        </View>
      ))}
    </View>
  )
}

export default function CommentModal({
  visible, onClose, videoId,
}: {
  visible: boolean; onClose: () => void; videoId: string
}) {
  const [userAvatar, setUserAvatar] = useState('')
  const [userName, setUserName] = useState('')
  const inputRef = useRef<TextInput>(null)
  const sheetHeight = SCREEN_HEIGHT * 0.8
  const translateY = useSharedValue(SCREEN_HEIGHT)
  const keyboardOffset = useSharedValue(0)

  const {
    comments, commentCount, repliesData, expandedReplies,
    inputText, replyingTo, sending, currentUser,
    setInputText, sendComment, cancelCurrentReply,
    startReply, likeComment, likeReply, dislikeComment, dislikeReply, toggleReplies,
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
      } catch {}
    }
    fetchUser()
  }, [currentUser])

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        keyboardOffset.value = withTiming(e.endCoordinates.height, { duration: 250 })
      }
    )
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardOffset.value = withTiming(0, { duration: 200 })
      }
    )
    return () => { show.remove(); hide.remove() }
  }, [keyboardOffset])

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 })
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 })
      Keyboard.dismiss()
    }
  }, [visible, translateY])

  const handleReply = useCallback((commentId: string, username: string) => {
    startReply(commentId, username)
    inputRef.current?.focus()
  }, [startReply])

const inputBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardOffset.value }],
  }))

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}
    >
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={{
          height: sheetHeight,
          backgroundColor: '#111111',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          transform: [{ translateY }],
        }}
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
              onLike={() => likeComment(item.id)}
              onDislike={() => dislikeComment(item.id)}
              onToggleReplies={() => toggleReplies(item.id)}
              expanded={!!expandedReplies[item.id]}
              replies={repliesData[item.id] || []}
              onLikeReply={likeReply}
              onDislikeReply={dislikeReply}
            />
          )}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textSecondary} />
              <Text style={{ color: '#888', fontSize: 15, marginTop: 12 }}>
                Aucun commentaire pour le moment
              </Text>
              <Text style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                Sois le premier à commenter !
              </Text>
            </View>
          }
        />
      </Animated.View>
      {visible && (
      <Animated.View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          backgroundColor: '#111111', borderTopWidth: 0.5, borderTopColor: '#222',
          ...inputBarStyle,
        }}
      >
          {replyingTo && (
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#222',
            }}>
              <Text style={{ color: '#888', fontSize: 13 }}>
                Réponse à{' '}
                <Text style={{ color: '#00A86B' }}>@{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={cancelCurrentReply}>
                <Text style={{ color: '#888', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
            <Avatar uri={userAvatar} name={userName} size={40} />
            <View style={{
              flex: 1, flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#2a2a2a', borderRadius: 24, paddingHorizontal: 14,
            }}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={replyingTo ? `Réponse à @${replyingTo.username}` : 'Ajouter un commentaire...'}
                placeholderTextColor="#666"
                style={{ flex: 1, paddingVertical: 8, color: 'white', fontSize: 14, maxHeight: 80 }}
                multiline
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TouchableOpacity style={{ padding: 6 }}>
                  <Ionicons name="image-outline" size={20} color="#888" />
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: 6 }}>
                  <Ionicons name="happy-outline" size={20} color="#888" />
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: 6 }}>
                  <Ionicons name="at-outline" size={20} color="#888" />
                </TouchableOpacity>
                {inputText.trim().length > 0 && (
                  <TouchableOpacity
                    onPress={sendComment}
                    disabled={sending}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="send" size={20} color="#00A86B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  )
}