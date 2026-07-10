import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { captureException } from '@/lib/sentry'
import { colors } from '@/lib/theme'
import type {
  NewsPostFormat,
  NewsPostMedia,
  NewsPostVisibility,
} from '@/features/news/types'

interface SelectedMedia {
  uri: string
  type: 'image' | 'video'
  width?: number
  height?: number
  duration?: number | null
}

const MAX_IMAGES = 8

function inferFormat(media: SelectedMedia[]): NewsPostFormat {
  if (media.length === 0) return 'text'
  if (media[0].type === 'video') return 'video'
  if (media.length > 1) return 'carousel'
  return 'image'
}

export default function NewsComposeScreen() {
  const [text, setText] = useState('')
  const [media, setMedia] = useState<SelectedMedia[]>([])
  const [visibility, setVisibility] =
    useState<NewsPostVisibility>('public')
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [progress, setProgress] = useState(0)

  const canPublish =
    !publishing &&
    (text.trim().length > 0 || media.length > 0)

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      quality: 0.9,
    })

    if (result.canceled) return

    const assets = result.assets.map((asset) => ({
      uri: asset.uri,
      type: asset.type === 'video' ? 'video' : 'image',
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
    } satisfies SelectedMedia))

    const videos = assets.filter((asset) => asset.type === 'video')

    if (videos.length > 0 && assets.length > 1) {
      Alert.alert(
        'Sélection non prise en charge',
        'Une publication vidéo ne peut contenir qu\'une seule vidéo.',
      )
      return
    }

    setMedia(assets.slice(0, MAX_IMAGES))
  }

  const removeMedia = (index: number) => {
    setMedia((current) =>
      current.filter((_, mediaIndex) => mediaIndex !== index),
    )
  }

  const cycleVisibility = () => {
    setVisibility((current) => {
      if (current === 'public') return 'followers'
      if (current === 'followers') return 'private'
      return 'public'
    })
  }

  const publish = async () => {
    const user = auth.currentUser
    if (!user || !canPublish) return

    setPublishing(true)
    setProgress(0)

    try {
      const profileSnapshot = await getDoc(
        doc(db, 'users', user.uid),
      )
      const profile = profileSnapshot.data()

      const uploaded: NewsPostMedia[] = []

      for (let index = 0; index < media.length; index++) {
        const item = media[index]

        const url = await uploadToCloudinary(
          item.uri,
          item.type,
          {
            folder: 'posts',
            timeout: 180000,
            onProgress: (itemProgress) => {
              const completed = index / Math.max(1, media.length)
              const current =
                itemProgress / 100 / Math.max(1, media.length)

              setProgress(
                Math.min(99, Math.round((completed + current) * 100)),
              )
            },
          },
        )

        uploaded.push({
          url,
          type: item.type,
          width: item.width,
          height: item.height,
          duration: item.duration ?? undefined,
        })
      }

      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        userName:
          profile?.nom ||
          profile?.pseudo ||
          user.displayName ||
          user.email?.split('@')[0] ||
          'Utilisateur',
        userPhotoURL:
          profile?.photoURL ||
          user.photoURL ||
          null,
        text: text.trim(),
        format: inferFormat(media),
        media: uploaded,
        visibility,
        commentsEnabled,
        likes: 0,
        likedBy: [],
        comments: 0,
        shares: 0,
        saves: 0,
        savedBy: [],
        moderationStatus: 'visible',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'users', user.uid), {
        postsCount: increment(1),
      }).catch(() => {})

      setProgress(100)
      router.replace('/(tabs)/stories')
    } catch (error) {
      captureException(
        error instanceof Error
          ? error
          : new Error(String(error)),
        { context: 'NewsCompose.publish' },
      )

      Alert.alert(
        'Publication impossible',
        'Vérifie ta connexion puis réessaie.',
      )
    } finally {
      setPublishing(false)
    }
  }

  const visibilityLabel =
    visibility === 'public'
      ? 'Tout le monde'
      : visibility === 'followers'
        ? 'Mes abonnés'
        : 'Moi uniquement'

  const visibilityIcon =
    visibility === 'public'
      ? 'earth'
      : visibility === 'followers'
        ? 'people'
        : 'lock-closed'

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.headerButton}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          <Text style={styles.title}>Créer une publication</Text>

          <Pressable
            onPress={publish}
            disabled={!canPublish}
            style={[
              styles.publishButton,
              !canPublish && styles.publishButtonDisabled,
            ]}
          >
            {publishing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.publishText}>Publier</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.authorRow}>
            {auth.currentUser?.photoURL ? (
              <Image
                source={{ uri: auth.currentUser.photoURL }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={22} color="#777" />
              </View>
            )}

            <View>
              <Text style={styles.authorName}>
                {auth.currentUser?.displayName || 'Vous'}
              </Text>

              <Pressable
                onPress={cycleVisibility}
                style={styles.visibility}
              >
                <Ionicons
                  name={visibilityIcon}
                  size={13}
                  color="#DDD"
                />
                <Text style={styles.visibilityText}>
                  {visibilityLabel}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={13}
                  color="#DDD"
                />
              </Pressable>
            </View>
          </View>

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Quoi de neuf ?"
            placeholderTextColor="#777"
            multiline
            maxLength={3000}
            autoFocus
            style={styles.input}
          />

          {media.length > 0 && (
            <View style={styles.mediaGrid}>
              {media.map((item, index) => (
                <View
                  key={`${item.uri}-${index}`}
                  style={[
                    styles.preview,
                    media.length === 1 && styles.previewSingle,
                  ]}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />

                  {item.type === 'video' && (
                    <View style={styles.videoBadge}>
                      <Ionicons
                        name="videocam"
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.videoBadgeText}>Vidéo</Text>
                    </View>
                  )}

                  <Pressable
                    onPress={() => removeMedia(index)}
                    style={styles.remove}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.optionsCard}>
            <Text style={styles.optionsTitle}>
              Ajouter à votre publication
            </Text>

            <Pressable onPress={pickMedia} style={styles.optionButton}>
              <View style={styles.optionIcon}>
                <Ionicons name="images" size={23} color="#45BD62" />
              </View>
              <Text style={styles.optionText}>Photo ou vidéo</Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color="#777"
              />
            </Pressable>

            <Pressable
              onPress={() => setCommentsEnabled((value) => !value)}
              style={styles.optionButton}
            >
              <View style={styles.optionIcon}>
                <Ionicons
                  name="chatbubble-ellipses"
                  size={22}
                  color="#F7B928"
                />
              </View>
              <Text style={styles.optionText}>Commentaires</Text>
              <Ionicons
                name={
                  commentsEnabled
                    ? 'toggle'
                    : 'toggle-outline'
                }
                size={30}
                color={
                  commentsEnabled
                    ? colors.primary
                    : '#666'
                }
              />
            </Pressable>
          </View>

          {publishing && (
            <View style={styles.progressCard}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                Publication en cours, {progress} %
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2B2E',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 4,
  },
  publishButton: {
    minWidth: 82,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonDisabled: {
    opacity: 0.38,
  },
  publishText: {
    color: '#fff',
    fontWeight: '700',
  },
  content: {
    paddingBottom: 60,
  },
  authorRow: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarFallback: {
    backgroundColor: '#24262A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  visibility: {
    marginTop: 5,
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#303236',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  visibilityText: {
    color: '#DDD',
    fontSize: 11,
    fontWeight: '600',
  },
  input: {
    minHeight: 160,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
    color: '#fff',
    fontSize: 21,
    lineHeight: 29,
    textAlignVertical: 'top',
  },
  mediaGrid: {
    marginHorizontal: 12,
    marginBottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  preview: {
    width: '49%',
    height: 190,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  previewSingle: {
    width: '100%',
    height: 360,
  },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    left: 9,
    bottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  videoBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  optionsCard: {
    margin: 12,
    borderWidth: 1,
    borderColor: '#303236',
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionsTitle: {
    padding: 14,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#303236',
  },
  optionButton: {
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#25272A',
  },
  optionIcon: {
    width: 38,
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    color: '#EFEFEF',
    fontSize: 14,
    fontWeight: '600',
  },
  progressCard: {
    marginHorizontal: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#181A1D',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  progressText: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 8,
  },
})
