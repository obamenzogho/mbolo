/* VideoEditorScreen — éditeur étape par étape pour créer un post (vidéo/photo).
   Étape 1 : Aperçu + Description + Hashtags
   Étape 2 : Visibilité + Paramètres
   Étape 3 : Publication Cloudinary + Firestore
   Compatible Expo Go — aucun module natif requis. */

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, Image, TextInput,
  ScrollView, Alert, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { uploadToCloudinary, generateThumbnailURL } from '../../src/lib/cloudinary'
import { normalizeTag } from '../../src/lib/hashtags'
import OrbitLoader from '../../src/components/OrbitLoader'
import { BackButton } from '../../src/components/ui/BackButton'
import { getCurrentPlace } from '../../src/features/location/locationService'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

type Step = 'edit' | 'settings' | 'publishing'

const SUGGESTED_HASHTAGS = ['#Gabon', '#Mbolo', '#Libreville', '#Afrique', '#241', '#PourToi', '#Viral']

const VISIBILITY_OPTIONS = [
  { value: 'public', icon: 'globe', label: 'Public', description: 'Tout le monde peut voir' },
  { value: 'friends', icon: 'people', label: 'Amis', description: 'Seulement tes amis' },
  { value: 'private', icon: 'lock-closed', label: 'Privé', description: 'Seulement toi' },
] as const

export default function VideoEditorScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mediaUri, mediaType } = useLocalSearchParams<{ mediaUri?: string; mediaType?: string }>()

  const [step, setStep] = useState<Step>('edit')
  const [description, setDescription] = useState('')
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([])
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(true)
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public')
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [coverUri, setCoverUri] = useState<string | null>(null)
  const [includeLocation, setIncludeLocation] = useState(false)
  const [placeInfo, setPlaceInfo] = useState<{ lat: number; lng: number; geohash: string; city: string | null; country: string | null } | null>(null)
  const [fetchingLocation, setFetchingLocation] = useState(false)

  const descriptionRef = useRef<TextInput>(null)

  const isVideo = mediaType === 'video'
  const videoPlayer = useVideoPlayer(isVideo && mediaUri ? mediaUri : null, (p) => { p.loop = true; p.muted = false })

  // Generate thumbnail for video cover
  useEffect(() => {
    if (isVideo && mediaUri) {
      VideoThumbnails.getThumbnailAsync(mediaUri, { time: 1000, quality: 0.5 })
        .then(result => setCoverUri(result.uri))
        .catch(() => {})
    }
  }, [isVideo, mediaUri])

  const toggleHashtag = useCallback((tag: string) => {
    setSelectedHashtags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }, [])

  const toggleLocation = useCallback(async () => {
    if (placeInfo) {
      setIncludeLocation(false)
      setPlaceInfo(null)
      return
    }
    setFetchingLocation(true)
    try {
      const place = await getCurrentPlace()
      if (place) {
        setPlaceInfo(place)
        setIncludeLocation(true)
      } else {
        Alert.alert('Localisation', 'Impossible de récupérer ta position. Vérifie les permissions.')
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer ta position')
    } finally {
      setFetchingLocation(false)
    }
  }, [placeInfo])

  const goToSettings = useCallback(() => {
    setStep('settings')
  }, [])

  const goBackToEdit = useCallback(() => {
    setStep('edit')
  }, [])

  const publish = useCallback(async () => {
    const user = auth.currentUser
    if (!user || !mediaUri) return

    setIsUploading(true)
    setStep('publishing')

    try {
      // 0. Fetch Firestore profile (photoURL, nom) — Auth photoURL is often null
      let firestorePhotoURL = user.photoURL ?? null
      let firestoreUserName = user.displayName ?? user.email?.split('@')[0] ?? 'Utilisateur'
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          if (typeof data.photoURL === 'string' && data.photoURL) firestorePhotoURL = data.photoURL
          if (typeof data.nom === 'string' && data.nom) firestoreUserName = data.nom
          else if (typeof data.pseudo === 'string' && data.pseudo) firestoreUserName = data.pseudo
        }
      } catch {}

      // 1. Upload media to Cloudinary
      const mediaUrl = await uploadToCloudinary(mediaUri, isVideo ? 'video' : 'image', {
        folder: isVideo ? 'reels' : 'images',
        timeout: 180000,
        onProgress: setUploadProgress,
      })

      if (!mediaUrl) {
        Alert.alert('Erreur', "Impossible d'uploader le média")
        setStep('settings')
        setIsUploading(false)
        return
      }

      // 2. Generate thumbnail
      const thumbnailURL = generateThumbnailURL(mediaUrl)

      // 3. Save to Firestore
      await addDoc(collection(db, 'videos'), {
        userId: user.uid,
        userName: firestoreUserName,
        userPhotoURL: firestorePhotoURL,
        videoURL: mediaUrl,
        thumbnailURL,
        coverURL: coverUri || thumbnailURL || '',
        description: description.trim(),
        hashtags: selectedHashtags.map(t => normalizeTag(t.replace(/^#/, ''))),
        visibility,
        commentsEnabled,
        ...(includeLocation && placeInfo ? {
          lat: placeInfo.lat, lng: placeInfo.lng,
          geohash: placeInfo.geohash, place: placeInfo.city,
        } : {}),
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        savedBy: [],
        createdAt: serverTimestamp(),
      })

      // 4. Update user posts count
      updateDoc(doc(db, 'users', user.uid), { postsCount: increment(1) }).catch(() => {})

      // 5. Go back to feed
      Alert.alert('Succès', 'Publication réussie !', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/feed') },
      ])
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de publier')
      setStep('settings')
      setIsUploading(false)
    }
  }, [mediaUri, isVideo, description, selectedHashtags, visibility, commentsEnabled, coverUri, router])

  // ─── PUBLISHING STEP ───
  if (step === 'publishing') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 20 }}>
          Publication en cours...
        </Text>
        <View style={{ width: 200, height: 4, backgroundColor: '#333', borderRadius: 2, marginTop: 16 }}>
          <View style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: colors.primary, borderRadius: 2 }} />
        </View>
        <Text style={{ color: '#888', fontSize: 13, marginTop: 8 }}>{uploadProgress}%</Text>
      </View>
    )
  }

  // ─── STEP 1: EDIT (Preview + Description + Hashtags) ───
  if (step === 'edit') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#000' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* HEADER */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, paddingTop: insets.top + 8 }}>
          <BackButton fallbackRoute="/(tabs)/feed" />
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Nouveau post</Text>
          <TouchableOpacity onPress={goToSettings} disabled={!description.trim()}>
            <Text style={{ color: description.trim() ? colors.primary : '#555', fontSize: 16, fontWeight: '700' }}>Suivant</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {/* PREVIEW */}
          <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.45, backgroundColor: '#111' }}>
            {isVideo ? (
              <VideoView
                player={videoPlayer}
                style={{ width: '100%', height: '100%' }}
                nativeControls
                contentFit="cover"
              />
            ) : (
              <Image source={{ uri: mediaUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            )}
          </View>

          {/* DESCRIPTION */}
          <View style={{ padding: 16 }}>
            <TextInput
              ref={descriptionRef}
              value={description}
              onChangeText={setDescription}
              placeholder="Écris une description..."
              placeholderTextColor="#555"
              multiline
              maxLength={500}
              style={{
                backgroundColor: '#1a1a1a',
                color: '#fff',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
            <Text style={{ color: '#555', fontSize: 12, textAlign: 'right', marginTop: 4 }}>
              {description.length}/500
            </Text>
          </View>

          {/* HASHTAGS */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 20 }}>
            <TouchableOpacity
              onPress={() => setShowHashtagSuggestions(!showHashtagSuggestions)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Hashtags</Text>
              <Ionicons name={showHashtagSuggestions ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
            </TouchableOpacity>

            {showHashtagSuggestions && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTED_HASHTAGS.map(tag => {
                  const selected = selectedHashtags.includes(tag)
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleHashtag(tag)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: selected ? colors.primary : '#1a1a1a',
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : '#333',
                      }}
                    >
                      <Text style={{ color: selected ? '#fff' : '#888', fontSize: 13, fontWeight: '600' }}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {selectedHashtags.length > 0 && !showHashtagSuggestions && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {selectedHashtags.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleHashtag(tag)}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#1a1a1a' }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12 }}>{tag} ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // ─── STEP 2: SETTINGS (Visibility + Comments + Cover) ───
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* HEADER */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, paddingTop: insets.top + 8 }}>
        <TouchableOpacity onPress={goBackToEdit}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Paramètres</Text>
        <TouchableOpacity onPress={publish} disabled={isUploading}>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>Publier</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* COVER */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 }}>Couverture</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {coverUri && (
              <View style={{ width: 80, height: 100, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary }}>
                <Image source={{ uri: coverUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </View>
            )}
            <View style={{ width: 80, height: 100, borderRadius: 8, overflow: 'hidden' }}>
              {isVideo ? (
                <VideoView
                  player={videoPlayer}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <Image source={{ uri: mediaUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              )}
            </View>
          </View>
        </View>

        {/* VISIBILITY */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 }}>Visibilité</Text>
          {VISIBILITY_OPTIONS.map(opt => {
            const selected = visibility === opt.value
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setVisibility(opt.value)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: '#1a1a1a',
                  borderRadius: 12,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : '#333',
                }}
              >
                <Ionicons name={opt.icon as any} size={22} color={selected ? colors.primary : '#888'} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{opt.label}</Text>
                  <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{opt.description}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* COMMENTS */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 }}>Commentaires</Text>
          <TouchableOpacity
            onPress={() => setCommentsEnabled(!commentsEnabled)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: '#1a1a1a',
              borderRadius: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="#888" />
              <Text style={{ color: '#fff', fontSize: 15 }}>Activer les commentaires</Text>
            </View>
            <View style={{
              width: 48, height: 28, borderRadius: 14,
              backgroundColor: commentsEnabled ? colors.primary : '#333',
              justifyContent: 'center',
              paddingHorizontal: 2,
            }}>
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: '#fff',
                alignSelf: commentsEnabled ? 'flex-end' : 'flex-start',
              }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* LOCATION */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 }}>Localisation</Text>
          <TouchableOpacity
            onPress={toggleLocation}
            disabled={fetchingLocation}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: '#1a1a1a',
              borderRadius: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="location-outline" size={22} color={includeLocation ? colors.primary : '#888'} />
              <View>
                <Text style={{ color: '#fff', fontSize: 15 }}>
                  {fetchingLocation ? 'Récupération...' : includeLocation ? placeInfo?.city ?? 'Position ajoutée' : 'Ajouter le lieu'}
                </Text>
                {includeLocation && placeInfo?.city && (
                  <Text style={{ color: '#888', fontSize: 12, marginTop: 1 }}>{placeInfo.city}</Text>
                )}
              </View>
            </View>
            {fetchingLocation ? (
              <OrbitLoader size={18} />
            ) : (
              <View style={{
                width: 48, height: 28, borderRadius: 14,
                backgroundColor: includeLocation ? colors.primary : '#333',
                justifyContent: 'center',
                paddingHorizontal: 2,
              }}>
                <View style={{
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: '#fff',
                  alignSelf: includeLocation ? 'flex-end' : 'flex-start',
                }} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* DESCRIPTION PREVIEW */}
        {description.trim() ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 30 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8 }}>Description</Text>
            <View style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16 }}>
              <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20 }}>{description}</Text>
              {selectedHashtags.length > 0 && (
                <Text style={{ color: colors.primary, fontSize: 13, marginTop: 8 }}>
                  {selectedHashtags.join(' ')}
                </Text>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
