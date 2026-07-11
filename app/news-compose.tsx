import { useEffect, useState } from 'react'
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
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
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
import { POST_BACKGROUNDS } from '@/features/news/types'
import type {
  NewsPostFormat,
  NewsPostMedia,
  NewsPostVisibility,
  NewsLocation,
  NewsMood,
  NewsPoll,
} from '@/features/news/types'

interface SelectedMedia {
  uri: string
  type: 'image' | 'video'
  width?: number
  height?: number
  duration?: number | null
}

const MAX_IMAGES = 8

const MOODS: NewsMood[] = [
  { emoji: '😀', label: 'heureux' },
  { emoji: '🥰', label: 'amoureux' },
  { emoji: '😎', label: 'cool' },
  { emoji: '😢', label: 'triste' },
  { emoji: '😡', label: 'énervé' },
  { emoji: '🎉', label: 'en fête' },
  { emoji: '😴', label: 'fatigué' },
  { emoji: '🙏', label: 'reconnaissant' },
]

function inferFormat(media: SelectedMedia[]): NewsPostFormat {
  if (media.length === 0) return 'text'
  if (media[0].type === 'video') return 'video'
  if (media.length > 1) return 'carousel'
  return 'image'
}

export default function NewsComposeScreen() {
  const { editPostId, sharedUrl } = useLocalSearchParams<{
    editPostId?: string
    sharedUrl?: string
  }>()
  const editing = Boolean(editPostId)

  const [text, setText] = useState('')
  const [media, setMedia] = useState<SelectedMedia[]>([])
  const [visibility, setVisibility] = useState<NewsPostVisibility>('public')
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loadingPost, setLoadingPost] = useState(editing)

  const [background, setBackground] = useState('none')
  const [location, setLocation] = useState<NewsLocation | null>(null)
  const [mood, setMood] = useState<NewsMood | null>(null)
  const [poll, setPoll] = useState<NewsPoll | null>(null)
  const [moodPickerOpen, setMoodPickerOpen] = useState(false)

  const canUseBackground = media.length === 0 && !poll
  const activeBg = POST_BACKGROUNDS.find((b) => b.id === background) ?? POST_BACKGROUNDS[0]

  const pollValid = poll
    ? poll.question.trim().length > 0 && poll.options.filter((o) => o.text.trim()).length >= 2
    : true

  const canPublish = !publishing && pollValid && (text.trim().length > 0 || media.length > 0 || (poll ? pollValid : false))

  useEffect(() => {
    if (sharedUrl && !editPostId) {
      setText(sharedUrl)
    }
  }, [sharedUrl, editPostId])

  useEffect(() => {
    if (!editPostId || !auth.currentUser) return

    let cancelled = false

    getDoc(doc(db, 'posts', editPostId))
      .then((snapshot) => {
        if (cancelled || !snapshot.exists()) return

        const data = snapshot.data()

        if (data.userId !== auth.currentUser?.uid) {
          Alert.alert('Action interdite', 'Vous ne pouvez pas modifier cette publication.')
          router.back()
          return
        }

        setText(data.text || '')
        setVisibility(data.visibility || 'public')
        setCommentsEnabled(data.commentsEnabled !== false)
      })
      .finally(() => {
        if (!cancelled) setLoadingPost(false)
      })

    return () => { cancelled = true }
  }, [editPostId])

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
      Alert.alert('Sélection non prise en charge', 'Une publication vidéo ne peut contenir qu\'une seule vidéo.')
      return
    }

    setMedia(assets.slice(0, MAX_IMAGES))
    setBackground('none')
  }

  const removeMedia = (index: number) => {
    setMedia((current) => current.filter((_, i) => i !== index))
  }

  const cycleVisibility = () => {
    setVisibility((current) => {
      if (current === 'public') return 'followers'
      if (current === 'followers') return 'private'
      return 'public'
    })
  }

  const detectLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Localisation', 'Autorise la localisation pour l\'ajouter.')
        return
      }
      const pos = await Location.getCurrentPositionAsync({})
      const geo = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      const place = geo[0]
      setLocation({
        name: place ? `${place.city || place.district || ''}${place.country ? `, ${place.country}` : ''}`.trim() || 'Position actuelle' : 'Position actuelle',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      })
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer la position.')
    }
  }

  const addPoll = () => {
    setBackground('none')
    setMedia([])
    setPoll({
      question: '',
      options: [
        { id: '1', text: '', votes: 0, votedBy: [] },
        { id: '2', text: '', votes: 0, votedBy: [] },
      ],
    })
  }

  const updatePollOption = (id: string, text: string) => {
    setPoll((p) => p ? { ...p, options: p.options.map((o) => o.id === id ? { ...o, text } : o) } : p)
  }

  const addPollOption = () => {
    setPoll((p) => {
      if (!p || p.options.length >= 4) return p
      return { ...p, options: [...p.options, { id: String(Date.now()), text: '', votes: 0, votedBy: [] }] }
    })
  }

  const publish = async () => {
    const user = auth.currentUser
    if (!user || !canPublish) return

    setPublishing(true)
    setProgress(0)

    try {
      const profileSnapshot = await getDoc(doc(db, 'users', user.uid))
      const profile = profileSnapshot.data()

      if (editPostId) {
        await updateDoc(doc(db, 'posts', editPostId), {
          text: text.trim(),
          visibility,
          commentsEnabled,
          updatedAt: serverTimestamp(),
        })

        router.replace('/(tabs)/stories')
        return
      }

      const uploaded: NewsPostMedia[] = []

      for (let index = 0; index < media.length; index++) {
        const item = media[index]

        const url = await uploadToCloudinary(item.uri, item.type, {
          folder: 'posts',
          timeout: 180000,
          onProgress: (itemProgress) => {
            const completed = index / Math.max(1, media.length)
            const current = itemProgress / 100 / Math.max(1, media.length)
            setProgress(Math.min(99, Math.round((completed + current) * 100)))
          },
        })

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
        userName: profile?.nom || profile?.pseudo || user.displayName || user.email?.split('@')[0] || 'Utilisateur',
        userPhotoURL: profile?.photoURL || user.photoURL || null,
        text: text.trim(),
        format: inferFormat(media),
        media: uploaded,
        visibility,
        commentsEnabled,
        background: media.length === 0 && !poll ? background : 'none',
        location: location ?? null,
        mood: mood ?? null,
        poll: poll ? {
          question: poll.question.trim(),
          options: poll.options.filter((o) => o.text.trim()).map((o) => ({ ...o, text: o.text.trim() })),
        } : null,
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
      captureException(error instanceof Error ? error : new Error(String(error)), { context: 'NewsCompose.publish' })

      Alert.alert('Publication impossible', 'Vérifie ta connexion puis réessaie.')
    } finally {
      setPublishing(false)
    }
  }

  const visibilityLabel = visibility === 'public' ? 'Tout le monde' : visibility === 'followers' ? 'Mes abonnés' : 'Moi uniquement'
  const visibilityIcon = visibility === 'public' ? 'earth' : visibility === 'followers' ? 'people' : 'lock-closed'

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          <Text style={styles.title}>
            {editing ? 'Modifier la publication' : 'Créer une publication'}
          </Text>

          <Pressable
            onPress={publish}
            disabled={!canPublish}
            style={[styles.publishButton, !canPublish && styles.publishButtonDisabled]}
          >
            {publishing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.publishText}>{editing ? 'Enregistrer' : 'Publier'}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.authorRow}>
            {auth.currentUser?.photoURL ? (
              <Image source={{ uri: auth.currentUser.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={22} color="#777" />
              </View>
            )}

            <View>
              <Text style={styles.authorName}>
                {auth.currentUser?.displayName || 'Vous'}
              </Text>

              <Pressable onPress={cycleVisibility} style={styles.visibility}>
                <Ionicons name={visibilityIcon} size={13} color="#DDD" />
                <Text style={styles.visibilityText}>{visibilityLabel}</Text>
                <Ionicons name="chevron-down" size={13} color="#DDD" />
              </Pressable>
            </View>
          </View>

          {(mood || location) && (
            <View style={styles.contextRow}>
              {mood && <Text style={styles.contextText}>se sent {mood.emoji} {mood.label}</Text>}
              {location && <Text style={styles.contextText}>📍 {location.name}</Text>}
            </View>
          )}

          {background !== 'none' && canUseBackground ? (
            <LinearGradient colors={activeBg.colors} style={styles.bgInputWrap}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Quoi de neuf ?"
                placeholderTextColor="rgba(255,255,255,0.7)"
                multiline
                maxLength={280}
                autoFocus
                style={styles.bgInput}
              />
            </LinearGradient>
          ) : (
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
          )}

          {canUseBackground && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bgPicker} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
              {POST_BACKGROUNDS.map((bg) => (
                <Pressable key={bg.id} onPress={() => setBackground(bg.id)}>
                  <LinearGradient
                    colors={bg.colors}
                    style={[styles.bgSwatch, background === bg.id && styles.bgSwatchActive]}
                  >
                    {bg.id === 'none' && <Ionicons name="text" size={18} color="#888" />}
                  </LinearGradient>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {media.length > 0 && (
            <View style={styles.mediaGrid}>
              {media.map((item, index) => (
                <View key={`${item.uri}-${index}`} style={[styles.preview, media.length === 1 && styles.previewSingle]}>
                  <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

                  {item.type === 'video' && (
                    <View style={styles.videoBadge}>
                      <Ionicons name="videocam" size={18} color="#fff" />
                      <Text style={styles.videoBadgeText}>Vidéo</Text>
                    </View>
                  )}

                  <Pressable onPress={() => removeMedia(index)} style={styles.remove}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {poll && (
            <View style={styles.pollCard}>
              <View style={styles.pollHeader}>
                <Text style={styles.pollTitle}>Sondage</Text>
                <Pressable onPress={() => setPoll(null)} hitSlop={10}>
                  <Ionicons name="close-circle" size={22} color="#888" />
                </Pressable>
              </View>
              <TextInput
                value={poll.question}
                onChangeText={(q) => setPoll((p) => p ? { ...p, question: q } : p)}
                placeholder="Posez votre question…"
                placeholderTextColor="#777"
                style={styles.pollQuestion}
                maxLength={200}
              />
              {poll.options.map((opt, i) => (
                <TextInput
                  key={opt.id}
                  value={opt.text}
                  onChangeText={(t) => updatePollOption(opt.id, t)}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor="#777"
                  style={styles.pollOption}
                  maxLength={80}
                />
              ))}
              {poll.options.length < 4 && (
                <Pressable onPress={addPollOption} style={styles.pollAdd}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={styles.pollAddText}>Ajouter une option</Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.optionsCard}>
            <Text style={styles.optionsTitle}>Ajouter à votre publication</Text>

            {!editing && (
              <>
                <Pressable onPress={pickMedia} style={styles.optionButton}>
                  <View style={styles.optionIcon}>
                    <Ionicons name="images" size={23} color="#45BD62" />
                  </View>
                  <Text style={styles.optionText}>Photo ou vidéo</Text>
                  <Ionicons name="chevron-forward" size={20} color="#777" />
                </Pressable>

                <Pressable onPress={() => setMoodPickerOpen(true)} style={styles.optionButton}>
                  <View style={styles.optionIcon}>
                    <Ionicons name="happy-outline" size={23} color="#F7B928" />
                  </View>
                  <Text style={styles.optionText}>{mood ? `Humeur : ${mood.emoji}` : 'Humeur / activité'}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#777" />
                </Pressable>

                <Pressable onPress={location ? () => setLocation(null) : detectLocation} style={styles.optionButton}>
                  <View style={styles.optionIcon}>
                    <Ionicons name="location-outline" size={23} color="#EB5757" />
                  </View>
                  <Text style={styles.optionText}>{location ? location.name : 'Localisation'}</Text>
                  <Ionicons name={location ? 'close' : 'chevron-forward'} size={20} color="#777" />
                </Pressable>

                {!poll && (
                  <Pressable onPress={addPoll} style={styles.optionButton}>
                    <View style={styles.optionIcon}>
                      <Ionicons name="bar-chart-outline" size={23} color="#2D9CDB" />
                    </View>
                    <Text style={styles.optionText}>Sondage</Text>
                    <Ionicons name="chevron-forward" size={20} color="#777" />
                  </Pressable>
                )}
              </>
            )}

            <Pressable onPress={() => setCommentsEnabled((value) => !value)} style={styles.optionButton}>
              <View style={styles.optionIcon}>
                <Ionicons name="chatbubble-ellipses" size={22} color="#F7B928" />
              </View>
              <Text style={styles.optionText}>Commentaires</Text>
              <Ionicons name={commentsEnabled ? 'toggle' : 'toggle-outline'} size={30} color={commentsEnabled ? colors.primary : '#666'} />
            </Pressable>
          </View>

          {publishing && (
            <View style={styles.progressCard}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>Publication en cours, {progress} %</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={moodPickerOpen} transparent animationType="slide" onRequestClose={() => setMoodPickerOpen(false)}>
        <Pressable style={styles.moodBackdrop} onPress={() => setMoodPickerOpen(false)}>
          <Pressable style={styles.moodSheet}>
            <Text style={styles.moodTitle}>Comment te sens-tu ?</Text>
            <View style={styles.moodGrid}>
              {MOODS.map((m) => (
                <Pressable key={m.label} onPress={() => { setMood(m); setMoodPickerOpen(false) }} style={styles.moodItem}>
                  <Text style={{ fontSize: 30 }}>{m.emoji}</Text>
                  <Text style={styles.moodLabel}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
            {mood && (
              <Pressable onPress={() => { setMood(null); setMoodPickerOpen(false) }} style={styles.moodClear}>
                <Text style={styles.moodClearText}>Retirer l'humeur</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  header: {
    minHeight: 58,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2B2E',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 4 },
  publishButton: { minWidth: 82, height: 38, borderRadius: 19, paddingHorizontal: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  publishButtonDisabled: { opacity: 0.38 },
  publishText: { color: '#fff', fontWeight: '700' },
  content: { paddingBottom: 60 },
  authorRow: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: '#24262A', alignItems: 'center', justifyContent: 'center' },
  authorName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  visibility: { marginTop: 5, minHeight: 26, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#303236', flexDirection: 'row', alignItems: 'center', gap: 5 },
  visibilityText: { color: '#DDD', fontSize: 11, fontWeight: '600' },
  input: { minHeight: 160, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18, color: '#fff', fontSize: 21, lineHeight: 29, textAlignVertical: 'top' },
  mediaGrid: { marginHorizontal: 12, marginBottom: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  preview: { width: '49%', height: 190, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111' },
  previewSingle: { width: '100%', height: 360 },
  remove: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' },
  videoBadge: { position: 'absolute', left: 9, bottom: 9, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(0,0,0,0.65)' },
  videoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  optionsCard: { margin: 12, borderWidth: 1, borderColor: '#303236', borderRadius: 14, overflow: 'hidden' },
  optionsTitle: { padding: 14, color: '#fff', fontSize: 15, fontWeight: '700', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#303236' },
  optionButton: { minHeight: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#25272A' },
  optionIcon: { width: 38, alignItems: 'center' },
  optionText: { flex: 1, color: '#EFEFEF', fontSize: 14, fontWeight: '600' },
  progressCard: { marginHorizontal: 12, padding: 14, borderRadius: 12, backgroundColor: '#181A1D' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#333' },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  progressText: { color: '#AAA', fontSize: 12, marginTop: 8 },
  bgInputWrap: { minHeight: 220, marginHorizontal: 12, marginTop: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 20 },
  bgInput: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', lineHeight: 32 },
  bgPicker: { marginTop: 10 },
  bgSwatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  bgSwatchActive: { borderColor: '#fff' },
  contextRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 3 },
  contextText: { color: '#B8B8B8', fontSize: 13 },
  pollCard: { marginHorizontal: 12, marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: '#181A1D', borderWidth: 1, borderColor: '#303236' },
  pollHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pollTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  pollQuestion: { color: '#fff', fontSize: 15, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#303236', marginBottom: 10 },
  pollOption: { color: '#fff', fontSize: 14, backgroundColor: '#25272A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  pollAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  pollAddText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  moodBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  moodSheet: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  moodTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: 12 },
  moodItem: { width: '22%', alignItems: 'center', paddingVertical: 10 },
  moodLabel: { color: '#CCC', fontSize: 11, marginTop: 4 },
  moodClear: { marginTop: 16, alignItems: 'center' },
  moodClearText: { color: '#E57373', fontSize: 14, fontWeight: '600' },
})
