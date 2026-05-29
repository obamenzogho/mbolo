import { useState, useCallback, useRef, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, Image, Alert, Keyboard, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { captureException } from '../../../lib/sentry'
import OrbitLoader from '../../../components/OrbitLoader'
import type { CommentData } from './CommentItem'

interface CommentInputProps {
  videoId: string
  replyingTo: CommentData | null
  currentUserPhotoURL?: string | null
  currentUserDisplayName?: string | null
  onCancelReply: () => void
  onPostComment: (text: string) => Promise<void>
  onPostReply: (commentId: string, text: string, replyToUsername: string | null) => Promise<void>
}

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '😂', '😮', '😢']

function CommentInputComponent({
  videoId, replyingTo, currentUserPhotoURL, currentUserDisplayName,
  onCancelReply, onPostComment, onPostReply,
}: CommentInputProps) {
  const [text, setText] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus()
    }
  }, [replyingTo])

  const handlePost = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || isPosting) return
    setIsPosting(true)
    try {
      if (replyingTo) {
        await onPostReply(replyingTo.id, trimmed, replyingTo.authorName || replyingTo.userName || null)
      } else {
        await onPostComment(trimmed)
      }
      setText('')
      if (replyingTo) onCancelReply()
      Keyboard.dismiss()
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'CommentInput:post' })
      Alert.alert('Erreur', 'Impossible de publier le commentaire.')
    } finally {
      setIsPosting(false)
    }
  }, [text, isPosting, replyingTo, videoId, onPostComment, onPostReply, onCancelReply])

  return (
    <View style={styles.wrapper}>
      {replyingTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>
            Réponse à{' '}
            <Text style={styles.replyBannerName}>
              @{replyingTo.authorName || replyingTo.userName || 'Utilisateur'}
            </Text>
          </Text>
          <TouchableOpacity onPress={onCancelReply}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputRow}>
        {currentUserPhotoURL ? (
          <Image source={{ uri: currentUserPhotoURL }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={16} color="#FFF" />
          </View>
        )}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder={replyingTo ? `Répondre à ${replyingTo.authorName || replyingTo.userName || 'Utilisateur'}…` : 'Ajouter un commentaire…'}
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            returnKeyType="default"
            blurOnSubmit={false}
          />
          <View style={styles.emojiRow}>
            {QUICK_EMOJIS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => setText((t) => t + emoji)}>
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.postBtn, { opacity: text.trim() && !isPosting ? 1 : 0.4 }]}
          disabled={!text.trim() || isPosting}
          onPress={handlePost}
        >
          {isPosting ? (
            <OrbitLoader size={20} />
          ) : (
            <Text style={styles.postBtnText}>Publier</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

export const CommentInput = CommentInputComponent

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 6,
    marginBottom: 6,
  },
  replyBannerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  replyBannerName: {
    color: '#00C853',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  textInput: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 60,
    padding: 0,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 6,
  },
  emoji: {
    fontSize: 18,
  },
  postBtn: {
    paddingHorizontal: 4,
  },
  postBtnText: {
    color: '#00C853',
    fontSize: 14,
    fontWeight: '700',
  },
})
