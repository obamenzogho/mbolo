import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, Image, TextInput,
  ActivityIndicator, Alert, Dimensions, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Video as AVVideo } from 'expo-av'
import { auth } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { useStories } from '../../src/hooks/useStories'
import HighlightPickerModal from '../../src/components/HighlightPickerModal'

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

  const { uploadStory } = useStories()

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

  // STEP 1: SELECT
  if (step === 'select') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', top: 50, left: 20 }}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>

        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 40 }}>
          Nouvelle story
        </Text>

        <View style={{ flexDirection: 'row', gap: 24 }}>
          <TouchableOpacity
            onPress={openCamera}
            style={{ width: 140, height: 140, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' }}
          >
            <Ionicons name="camera" size={48} color={colors.primary} />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 12 }}>Caméra</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={pickFromGallery}
            style={{ width: 140, height: 140, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' }}
          >
            <Ionicons name="images" size={48} color={colors.primary} />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 12 }}>Galerie</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // STEP 2: EDIT
  if (step === 'edit' && mediaUri) {
    return (
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
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
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
    )
  }

  // UPLOADING
  if (step === 'uploading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: '#fff', fontSize: 16, marginTop: 16, fontWeight: '600' }}>Publication en cours...</Text>
      </View>
    )
  }

  return null
}
