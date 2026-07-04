import { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, Image, TextInput,
  Alert, Dimensions, Modal,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { collection, addDoc, doc, increment, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { uploadToCloudinary, generateThumbnailURL } from '../../src/lib/cloudinary'
import OrbitLoader from '../../src/components/OrbitLoader'
import { BackButton } from '../../src/components/ui/BackButton'
import { colors } from '../../src/lib/theme'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

export default function ReelUploadScreen() {
  const router = useRouter()
  const user = auth.currentUser

  const [step, setStep] = useState<'select' | 'edit' | 'uploading'>('select')
  const [videoUri, setVideoUri] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [coverUri, setCoverUri] = useState<string | null>(null)

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
      videoMaxDuration: 60,
    })
    if (!result.canceled && result.assets.length > 0) {
      setVideoUri(result.assets[0].uri)
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
      mediaTypes: ['videos'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
      videoMaxDuration: 60,
    })
    if (!result.canceled && result.assets.length > 0) {
      setVideoUri(result.assets[0].uri)
      setStep('edit')
    }
  }

  const uploadToCloudinaryFn = async (uri: string): Promise<string | null> => {
    try {
      return await uploadToCloudinary(uri, 'video', { folder: 'reels', timeout: 120000 })
    } catch { return null }
  }

  const publishReel = async () => {
    if (!user || !videoUri) return
    setStep('uploading')
    try {
      // Fetch Firestore profile for correct photoURL/name
      let firestorePhotoURL = user?.photoURL ?? null
      let firestoreUserName = user?.displayName ?? user?.email?.split('@')[0] ?? 'Utilisateur'
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          if (typeof data.photoURL === 'string' && data.photoURL) firestorePhotoURL = data.photoURL
          if (typeof data.nom === 'string' && data.nom) firestoreUserName = data.nom
          else if (typeof data.pseudo === 'string' && data.pseudo) firestoreUserName = data.pseudo
        }
      } catch {}

      const videoUrl = await uploadToCloudinaryFn(videoUri)
      if (!videoUrl) {
        Alert.alert('Erreur', 'Impossible d\'uploader le vidéo')
        setStep('edit')
        return
      }

      await addDoc(collection(db, 'videos'), {
        userId: user.uid,
        userName: firestoreUserName,
        userPhotoURL: firestorePhotoURL,
        videoURL: videoUrl,
        thumbnailURL: generateThumbnailURL(videoUrl),
        coverURL: coverUri || generateThumbnailURL(videoUrl) || '',
        description: description.trim(),
        hashtags: [],
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        createdAt: serverTimestamp(),
      })
      updateDoc(doc(db, 'users', user.uid), { postsCount: increment(1) }).catch(() => {})

      Alert.alert('Succès', 'Reel publié ! 🇬🇦', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/feed') },
      ])
    } catch (e) {
      console.error(e)
      Alert.alert('Erreur', 'Impossible de publier le reel')
      setStep('edit')
    }
  }

  // STEP 1: SELECT
  if (step === 'select') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <BackButton fallbackRoute="/(tabs)/feed" style={{ position: 'absolute', top: 50, left: 20 }} />

        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Ionicons name="videocam" size={64} color={colors.primary} />
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 16 }}>
            Nouveau Reel
          </Text>
          <Text style={{ color: '#888', fontSize: 14, marginTop: 8 }}>
            Format 9:16 • Max 60s
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 24 }}>
          <TouchableOpacity
            onPress={openCamera}
            style={{ width: 140, height: 140, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' }}
          >
            <Ionicons name="camera" size={48} color={colors.primary} />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 12 }}>Caméra</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={pickVideo}
            style={{ width: 140, height: 140, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' }}
          >
            <Ionicons name="film" size={48} color={colors.primary} />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 12 }}>Galerie</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // STEP 2: EDIT
  if (step === 'edit' && videoUri) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* VIDEO PREVIEW */}
        <View style={{ width: '100%', height: SCREEN_HEIGHT * 0.55, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
          <Image source={{ uri: videoUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Aperçu</Text>
          </View>
        </View>

        {/* FORM */}
        <View style={{ flex: 1, backgroundColor: '#0a0a0a', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, padding: 20 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Détails du Reel</Text>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Décris ton reel..."
            placeholderTextColor="#555"
            maxLength={300}
            multiline
            style={{ backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, minHeight: 80, marginBottom: 16 }}
          />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => { setVideoUri(null); setStep('select') }}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#333', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={publishReel}
              disabled={!videoUri}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Publier</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  // UPLOADING
  if (step === 'uploading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
        <Text style={{ color: '#fff', fontSize: 16, marginTop: 16, fontWeight: '600' }}>Publication du reel...</Text>
      </View>
    )
  }

  return null
}
