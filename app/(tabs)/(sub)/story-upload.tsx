import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, Image, TextInput,
  Alert, Dimensions, Modal, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Video as AVVideo } from 'expo-av'
import { auth } from '@/lib/firebase'
import OrbitLoader from '@/components/OrbitLoader'
import { BackButton } from '@/components/ui/BackButton'
import PageWrapper from '@/components/PageWrapper'
import { colors } from '@/lib/theme'
import { useStories } from '@/hooks/useStories'
import { STORY_BACKGROUNDS } from '@/features/stories/constants'
import HighlightPickerModal from '@/components/HighlightPickerModal'

const SCREEN_WIDTH = Dimensions.get('window').width
const SCREEN_HEIGHT = Dimensions.get('window').height

export default function StoryUploadScreen() {
  const router = useRouter()
  const { storyMedia } = useLocalSearchParams<{ storyMedia?: string }>()
  const user = auth.currentUser

  const [step, setStep] = useState<'select' | 'edit' | 'uploading'>('select')
  const [mediaUri, setMediaUri] = useState<string | null>(storyMedia || null)
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [caption, setCaption] = useState('')
  const [textOverlay, setTextOverlay] = useState('')
  const [showTextEditor, setShowTextEditor] = useState(false)
  const [textPosition, setTextPosition] = useState({ x: SCREEN_WIDTH / 2 - 100, y: SCREEN_HEIGHT / 2 - 20 })
  const [highlightPickerVisible, setHighlightPickerVisible] = useState(false)
  const [storyId, setStoryId] = useState<string | null>(null)
  const [storyMode, setStoryMode] = useState<'media' | 'text'>('media')
  const [textStoryContent, setTextStoryContent] = useState('')
  const [selectedBg, setSelectedBg] = useState(STORY_BACKGROUNDS[0])

  const { uploadStory, uploadTextStory } = useStories()

  useEffect(() => {
    if (mediaUri) setStep('edit')
  }, [mediaUri])

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
      videoMaxDuration: 15,
    })
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0]
      setMediaUri(asset.uri)
      setMediaType(asset.type === 'video' ? 'video' : 'image')
      setStep('edit')
    }
  }

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la caméra.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
      videoMaxDuration: 15,
    })
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0]
      setMediaUri(asset.uri)
      setMediaType(asset.type === 'video' ? 'video' : 'image')
      setStep('edit')
    }
  }

  const publishStory = async () => {
    if (!user || !mediaUri) return
    setStep('uploading')
    try {
      const id = await uploadStory(mediaUri, mediaType, caption, textOverlay, textPosition)
      setStoryId(id)
      setStep('edit')
      Alert.alert('Succès', 'Votre story a été publiée', [
        { text: 'OK' },
        { text: 'Ajouter à la une', onPress: () => setHighlightPickerVisible(true) },
      ])
    } catch (e) {
      console.error(e)
      Alert.alert('Erreur', 'Impossible de publier la story')
      setStep('edit')
    }
  }

  const publishTextStory = async () => {
    if (!user || !textStoryContent.trim()) return
    setStep('uploading')
    try {
      const id = await uploadTextStory(textStoryContent.trim(), selectedBg.id, selectedBg.colors)
      setStoryId(id)
      Alert.alert('Succès', 'Votre story a été publiée', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e) {
      console.error(e)
      Alert.alert('Erreur', 'Impossible de publier la story')
      setStep('select')
    }
  }

  // STEP 1: SELECT
  if (step === 'select') {
    return (
      <PageWrapper type="stack" swipeBack backTo="/(tabs)/feed">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <BackButton style={{ position: 'absolute', top: 50, left: 20 }} />

        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 40 }}>
          Nouvelle story
        </Text>

        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity
            onPress={openCamera}
            style={{ width: 120, height: 120, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' }}
          >
            <Ionicons name="camera" size={40} color={colors.primary} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 10 }}>Caméra</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={pickFromGallery}
            style={{ width: 120, height: 120, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' }}
          >
            <Ionicons name="images" size={40} color={colors.primary} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 10 }}>Galerie</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setStoryMode('text'); setStep('edit') }}
            style={{ width: 120, height: 120, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' }}
          >
            <Ionicons name="text" size={40} color={colors.primary} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 10 }}>Texte</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      </PageWrapper>
    )
  }

  // STEP 2: TEXT EDIT
  if (step === 'edit' && storyMode === 'text') {
    return (
      <PageWrapper type="stack" swipeBack backTo="/(tabs)/feed">
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={selectedBg.colors as [string, string]}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView style={{ flex: 1 }}>
            {/* TOP BAR */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
              <BackButton style={{ padding: 8 }} />
              <View />
            </View>

            {/* TEXT INPUT */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
              <TextInput
                value={textStoryContent}
                onChangeText={setTextStoryContent}
                placeholder="Écris ton message..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                maxLength={300}
                multiline
                textAlign="center"
                style={{ color: '#fff', fontSize: 28, fontWeight: '700', width: '100%', minHeight: 120 }}
              />
            </View>

            {/* BACKGROUND PICKER */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
            >
              {STORY_BACKGROUNDS.map((bg) => (
                <TouchableOpacity
                  key={bg.id}
                  onPress={() => setSelectedBg(bg)}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    borderWidth: selectedBg.id === bg.id ? 3 : 0,
                    borderColor: '#fff',
                    overflow: 'hidden',
                  }}
                >
                  <LinearGradient colors={bg.colors as [string, string]} style={{ flex: 1 }} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* PUBLISH BUTTON */}
            <View style={{ padding: 20, paddingBottom: 40 }}>
              <TouchableOpacity
                onPress={publishTextStory}
                disabled={!textStoryContent.trim()}
                style={{
                  backgroundColor: textStoryContent.trim() ? colors.primary : '#333',
                  borderRadius: 25, paddingVertical: 14, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Publier</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
      </PageWrapper>
    )
  }

  // STEP 2: MEDIA EDIT
  if (step === 'edit' && mediaUri) {
    return (
      <PageWrapper type="stack" swipeBack backTo="/(tabs)/feed">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* MEDIA */}
        {mediaType === 'video' ? (
          <AVVideo source={{ uri: mediaUri }} style={{ width: '100%', height: '100%' }} shouldPlay isLooping />
        ) : (
          <Image source={{ uri: mediaUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        )}

        {/* TEXT OVERLAY */}
        {textOverlay ? (
          <View style={{ position: 'absolute', left: textPosition.x, top: textPosition.y }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 }}>
              {textOverlay}
            </Text>
          </View>
        ) : null}

        {/* TOP BAR */}
        <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
            <BackButton style={{ padding: 8 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setShowTextEditor(true)} style={{ padding: 8 }}>
                <Ionicons name="text" size={26} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Bientôt', 'Les stickers arrivent bientôt !')} style={{ padding: 8 }}>
                <Ionicons name="happy" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        {/* BOTTOM ACTIONS */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Ajouter une légende..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: 25, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 }}
            />
            <TouchableOpacity
              onPress={publishStory}
              style={{ backgroundColor: colors.primary, borderRadius: 25, paddingHorizontal: 16, paddingVertical: 10 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Publier</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TEXT EDITOR MODAL */}
        <Modal visible={showTextEditor} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' }}>Ajouter du texte</Text>
              <TextInput
                value={textOverlay}
                onChangeText={setTextOverlay}
                placeholder="Votre texte..."
                placeholderTextColor="#555"
                maxLength={100}
                multiline
                style={{ backgroundColor: '#111', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, minHeight: 80, marginBottom: 16 }}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={() => setShowTextEditor(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#333', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTextEditor(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* HIGHLIGHT PICKER */}
        <HighlightPickerModal
          visible={highlightPickerVisible}
          onClose={() => setHighlightPickerVisible(false)}
          storyId={storyId}
          coverUri={mediaUri || undefined}
        />
      </View>
      </PageWrapper>
    )
  }

  // UPLOADING
  if (step === 'uploading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
        <Text style={{ color: '#fff', fontSize: 16, marginTop: 16, fontWeight: '600' }}>Publication en cours...</Text>
      </View>
    )
  }

  return null
}
