import { useState, useCallback, useRef, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, Image, Alert, Keyboard, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { captureException } from '../../../lib/sentry'
import { colors } from '../../../lib/theme'
import { collection, query, where, orderBy, startAt, endAt, getDocs, limit } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
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
  const [suggestions, setSuggestions] = useState<{ uid: string; pseudo: string; photoURL?: string }[]>([])
  const inputRef = useRef<TextInput>(null)
  const mentionQueryRef = useRef<string | null>(null)

  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus()
    }
  }, [replyingTo])

  const searchUsers = useCallback(async (prefix: string) => {
    if (prefix.length < 1) return
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('pseudo'),
        startAt(prefix),
        endAt(prefix + '\uf8ff'),
        limit(6),
      )
      const snap = await getDocs(q)
      setSuggestions(snap.docs.map((d) => ({ uid: d.id, pseudo: d.data().pseudo, photoURL: d.data().photoURL })))
    } catch { setSuggestions([]) }
  }, [])

  const onChangeText = useCallback((val: string) => {
    setText(val)
    const match = /@([a-zA-Z0-9_]{1,30})$/.exec(val)
    if (match) {
      mentionQueryRef.current = match[1].toLowerCase()
      searchUsers(match[1].toLowerCase())
    } else {
      mentionQueryRef.current = null
      setSuggestions([])
    }
  }, [searchUsers])

  const pickSuggestion = useCallback((pseudo: string) => {
    setText((t) => t.replace(/@[a-zA-Z0-9_]{1,30}$/, `@${pseudo} `))
    setSuggestions([])
    mentionQueryRef.current = null
  }, [])

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
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputRow}>
        {currentUserPhotoURL ? (
          <Image source={{ uri: currentUserPhotoURL }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={16} color={colors.white} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          {suggestions.length > 0 && (
            <View style={{ maxHeight: 180, backgroundColor: colors.surface, borderRadius: 8, marginBottom: 4, overflow: 'hidden' }}>
              {suggestions.map((s) => (
                <TouchableOpacity key={s.uid} onPress={() => pickSuggestion(s.pseudo)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}>
                  {s.photoURL
                    ? <Image source={{ uri: s.photoURL }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                    : <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceLight }} />}
                  <Text style={{ color: colors.text }}>@{s.pseudo}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder={replyingTo ? `Répondre à ${replyingTo.authorName || replyingTo.userName || 'Utilisateur'}…` : 'Ajouter un commentaire…'}
            placeholderTextColor={colors.textFaint}
            value={text}
            onChangeText={onChangeText}
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
    borderTopColor: colors.hairline,
    backgroundColor: colors.surface,
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
    color: colors.textMuted,
    fontSize: 12,
  },
  replyBannerName: {
    color: colors.primary,
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
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  textInput: {
    color: colors.white,
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
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
})
