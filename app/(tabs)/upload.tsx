import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { collection, addDoc, doc, increment, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { uploadVideo as uploadToStorage } from '../../src/lib/storage'
import { generateThumbnailURL } from '../../src/lib/cloudinary'
import { extractHashtags } from '../../src/lib/hashtags'
import { colors } from '../../src/lib/theme'
import { TagPeopleSelector, type TaggableUser } from '../../src/components/TagPeopleSelector'

export default function Upload() {
  const [video, setVideo] = useState<any>(null)
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [tagged, setTagged] = useState<TaggableUser[]>([])
  const [tagOpen, setTagOpen] = useState(false)

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    })
    if (!result.canceled) {
      setVideo(result.assets[0])
    }
  }

  const recordVideo = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission requise', 'Il faut autoriser la caméra')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    })
    if (!result.canceled) {
      setVideo(result.assets[0])
    }
  }

  const uploadVideo = async () => {
    if (!video || !auth.currentUser) return
    setUploading(true)
    try {
      // Fetch Firestore profile for correct photoURL/name
      let firestorePhotoURL = auth.currentUser?.photoURL ?? null
      let firestoreUserName = auth.currentUser?.displayName ?? auth.currentUser?.email?.split('@')[0] ?? 'Utilisateur'
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          if (typeof data.photoURL === 'string' && data.photoURL) firestorePhotoURL = data.photoURL
          if (typeof data.nom === 'string' && data.nom) firestoreUserName = data.nom
          else if (typeof data.pseudo === 'string' && data.pseudo) firestoreUserName = data.pseudo
        }
      } catch {}

      const result = await uploadToStorage(video.uri)

      await addDoc(collection(db, 'videos'), {
        userId: auth.currentUser.uid,
        userName: firestoreUserName,
        userPhotoURL: firestorePhotoURL,
        videoURL: result.uri,
        thumbnailURL: generateThumbnailURL(result.uri),
        description,
        hashtags: extractHashtags(description),
        taggedUsers: tagged.map((u) => u.id),
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        savedBy: [],
        createdAt: serverTimestamp(),
      })
      updateDoc(doc(db, 'users', auth.currentUser.uid), { postsCount: increment(1) }).catch(() => {})

      Alert.alert('Succès', 'Vidéo publiée ! 🇬🇦')
      setVideo(null)
    } catch (error: any) {
      Alert.alert('Erreur', error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text
          style={{
            fontSize: 28, fontWeight: '800', color: colors.white,
            marginBottom: 8,
          }}
        >
          Publier une vidéo
        </Text>
        <Text
          style={{
            color: colors.textSecondary, fontSize: 14, marginBottom: 32,
            textAlign: 'center',
          }}
        >
          Partage ton talent avec le Gabon et le monde 🇬🇦
        </Text>

        {video ? (
          <View style={{ alignItems: 'center' }}>
            <Image
              source={{ uri: video.uri }}
              style={{
                width: 200, height: 350, borderRadius: 12,
                backgroundColor: colors.surface, marginBottom: 16,
              }}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Ajoute une légende avec #hashtags..."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
              style={{
                width: '100%', color: colors.text, backgroundColor: colors.surface,
                borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16,
                borderWidth: 1, borderColor: colors.border, maxHeight: 100,
              }}
            />
            <TouchableOpacity
              onPress={() => setTagOpen(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, marginBottom: 16 }}
            >
              <Ionicons name="person-add-outline" size={20} color={colors.text} />
              <Text style={{ color: colors.text }}>
                {tagged.length ? `${tagged.length} personne(s) identifiée(s)` : 'Identifier des personnes'}
              </Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setVideo(null)}
                style={{
                  backgroundColor: colors.surfaceLight,
                  paddingHorizontal: 20, paddingVertical: 12,
                  borderRadius: 12, borderWidth: 1, borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text }}>Changer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={uploadVideo}
                disabled={uploading}
                style={{
                  backgroundColor: uploading ? colors.textSecondary : colors.primary,
                  paddingHorizontal: 24, paddingVertical: 12,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: colors.white, fontWeight: '700' }}>
                  {uploading ? 'Publication...' : 'Publier'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ gap: 16, width: '100%' }}>
            <TouchableOpacity
              onPress={recordVideo}
              style={{
                backgroundColor: colors.surface,
                padding: 24, borderRadius: 16,
                borderWidth: 1, borderColor: colors.border,
                alignItems: 'center', borderStyle: 'dashed',
              }}
            >
              <Ionicons name="camera" size={48} color={colors.primary} />
              <Text
                style={{
                  color: colors.white, fontSize: 16, fontWeight: '600',
                  marginTop: 8,
                }}
              >
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickVideo}
              style={{
                backgroundColor: colors.surface,
                padding: 24, borderRadius: 16,
                borderWidth: 1, borderColor: colors.border,
                alignItems: 'center', borderStyle: 'dashed',
              }}
            >
              <Ionicons name="folder-open" size={48} color={colors.secondary} />
              <Text
                style={{
                  color: colors.white, fontSize: 16, fontWeight: '600',
                  marginTop: 8,
                }}
              >
                Choisir depuis la galerie
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <TagPeopleSelector
        visible={tagOpen}
        selected={tagged}
        onClose={() => setTagOpen(false)}
        onChange={setTagged}
      />
    </SafeAreaView>
  )
}
