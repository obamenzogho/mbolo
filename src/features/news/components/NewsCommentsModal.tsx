import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { auth } from '@/lib/firebase'
import { colors } from '@/lib/theme'
import { useNewsComments } from '../hooks/useNewsComments'
import type { NewsPost } from '../types'

interface Props {
  post: NewsPost | null
  visible: boolean
  onClose: () => void
}

function formatTime(date: Date): string {
  const minutes = Math.floor(
    (Date.now() - date.getTime()) / 60000,
  )

  if (minutes < 1) return 'Maintenant'
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`
  return `${Math.floor(minutes / 1440)} j`
}

export default function NewsCommentsModal({
  post,
  visible,
  onClose,
}: Props) {
  const uid = auth.currentUser?.uid ?? ''
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  const {
    comments,
    loading,
    addComment,
    deleteComment,
    toggleLikeComment,
  } = useNewsComments(post?.id ?? null, post?.userId)

  const publish = async () => {
    if (!text.trim() || posting) return

    setPosting(true)
    const ok = await addComment(text)
    setPosting(false)

    if (ok) {
      setText('')
    } else {
      Alert.alert(
        'Erreur',
        'Impossible de publier ce commentaire.',
      )
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.headerButton}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Commentaires</Text>
              <Text style={styles.subtitle}>
                {comments.length} commentaire
                {comments.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.headerButton} />
          </View>

          <FlatList
            data={comments}
            keyExtractor={(comment) => comment.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              comments.length === 0
                ? styles.emptyList
                : styles.list
            }
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                />
              ) : (
                <View style={styles.empty}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={48}
                    color="#555"
                  />
                  <Text style={styles.emptyTitle}>
                    Aucun commentaire
                  </Text>
                  <Text style={styles.emptyText}>
                    Soyez le premier à réagir.
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const liked = item.likedBy.includes(uid)
              const mine = item.userId === uid

              return (
                <View style={styles.comment}>
                  {item.userPhotoURL ? (
                    <Image
                      source={{ uri: item.userPhotoURL }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View
                      style={[styles.avatar, styles.avatarFallback]}
                    >
                      <Ionicons
                        name="person"
                        size={18}
                        color="#777"
                      />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <View style={styles.bubble}>
                      <Text style={styles.userName}>
                        {item.userName}
                      </Text>
                      <Text style={styles.commentText}>
                        {item.text}
                      </Text>
                    </View>

                    <View style={styles.commentActions}>
                      <Text style={styles.time}>
                        {formatTime(item.createdAt)}
                      </Text>

                      <Pressable
                        onPress={() => toggleLikeComment(item.id)}
                      >
                        <Text
                          style={[
                            styles.commentAction,
                            liked && { color: colors.primary },
                          ]}
                        >
                          J'aime
                        </Text>
                      </Pressable>

                      {item.likes > 0 && (
                        <Text style={styles.time}>
                          {item.likes}
                        </Text>
                      )}

                      {mine && (
                        <Pressable
                          onPress={() => {
                            Alert.alert(
                              'Supprimer le commentaire',
                              'Cette action est définitive.',
                              [
                                {
                                  text: 'Annuler',
                                  style: 'cancel',
                                },
                                {
                                  text: 'Supprimer',
                                  style: 'destructive',
                                  onPress: () =>
                                    deleteComment(item.id),
                                },
                              ],
                            )
                          }}
                        >
                          <Text style={styles.delete}>Supprimer</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              )
            }}
          />

          <View style={styles.inputBar}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Écrire un commentaire…"
              placeholderTextColor="#777"
              multiline
              maxLength={1000}
              style={styles.input}
            />

            <Pressable
              onPress={publish}
              disabled={!text.trim() || posting}
              style={[
                styles.send,
                (!text.trim() || posting) && { opacity: 0.4 },
              ]}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#111214',
  },
  header: {
    minHeight: 60,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#303236',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  list: {
    paddingVertical: 12,
  },
  emptyList: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyText: {
    color: '#888',
    fontSize: 13,
    marginTop: 5,
  },
  comment: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    backgroundColor: '#292B2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#292B2F',
  },
  userName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  commentText: {
    color: '#ECECEC',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },
  commentActions: {
    minHeight: 26,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  time: {
    color: '#777',
    fontSize: 11,
  },
  commentAction: {
    color: '#AAA',
    fontSize: 11,
    fontWeight: '700',
  },
  delete: {
    color: '#E57373',
    fontSize: 11,
    fontWeight: '700',
  },
  inputBar: {
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#303236',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#111214',
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#fff',
    backgroundColor: '#292B2F',
  },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
