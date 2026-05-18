import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, Image, TextInput,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../src/lib/firebase'
import { uploadToCloudinary } from '../src/lib/cloudinary'
import { colors } from '../src/lib/theme'

const SUGGESTED_HASHTAGS = ['#Gabon', '#Mbolo', '#Libreville', '#Afrique', '#241', '#GabonTikTok', '#PourToi', '#Viral']

type Visibility = 'public' | 'friends' | 'private'

export default function PostScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()

  const mediaUri = params.mediaUri as string
  const mediaType = params.mediaType as string
  const initialDescription = params.description as string
  const filter = params.filter as string
  const filterIntensity = parseInt(params.filterIntensity as string) || 100
  const speed = parseFloat(params.speed as string) || 1
  const trimStart = parseFloat(params.trimStart as string) || 0
  const trimEnd = parseFloat(params.trimEnd as string) || 100
  const textOverlaysStr = params.textOverlays as string
  const hashtagsStr = params.hashtags as string
  const selectedSound = params.selectedSound as string

  const [description, setDescription] = useState(initialDescription || '')
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>(hashtagsStr ? hashtagsStr.split(',').filter(Boolean) : [])
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [duoEnabled, setDuoEnabled] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  let textOverlays: any[] = []
  try {
    if (textOverlaysStr) textOverlays = JSON.parse(textOverlaysStr)
  } catch {}

  const toggleHashtag = (tag: string) => {
    setSelectedHashtags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const uploadMedia = async (uri: string): Promise<string | null> => {
    const isVideo = mediaType === 'video'
    try {
      return await uploadToCloudinary(uri, isVideo ? 'video' : 'image', {
        folder: 'reels',
        timeout: 180000,
        onProgress: (progress) => setUploadProgress(progress),
      })
    } catch {
      return null
    }
  }

  const publish = async () => {
    if (!auth.currentUser || !mediaUri) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const mediaUrl = await uploadMedia(mediaUri)
      if (!mediaUrl) {
        Alert.alert('Erreur', 'Impossible d\'uploader le média')
        setUploading(false)
        return
      }
      await addDoc(collection(db, 'videos'), {
        userId: auth.currentUser.uid,
        videoURL: mediaUrl,
        coverURL: '',
        description: description.trim(),
        hashtags: selectedHashtags,
        filter,
        filterIntensity,
        speed,
        trimStart,
        trimEnd,
        textOverlays,
        selectedSound,
        visibility,
        commentsEnabled,
        duoEnabled,
        likes: 0,
        comments: 0,
        shares: 0,
        createdAt: serverTimestamp(),
      })
      Alert.alert('Succès', 'Reel publié ! 🇬🇦', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/feed') },
      ])
    } catch (e) {
      console.error('Publish error:', e)
      Alert.alert('Erreur', 'Impossible de publier le reel')
    }
    setUploading(false)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Publier</Text>
          <TouchableOpacity onPress={publish} disabled={uploading} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: uploading ? '#333' : '#00A86B' }}>
            {uploading ? (
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>{uploadProgress}%</Text>
            ) : (
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Publier</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* MINIATURE + DESCRIPTION */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <View style={{ width: 100, height: 140, borderRadius: 12, overflow: 'hidden', backgroundColor: '#111' }}>
              {mediaType === 'video' ? (
                <Image source={{ uri: mediaUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Image source={{ uri: mediaUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Décris ta vidéo..."
                placeholderTextColor="#555"
                maxLength={300}
                multiline
                style={{ backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top' }}
              />
              <Text style={{ color: '#555', fontSize: 11, textAlign: 'right', marginTop: 4 }}>{description.length}/300</Text>
            </View>
          </View>

          {/* HASHTAGS SUGGÉRÉS */}
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Hashtags suggérés</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {SUGGESTED_HASHTAGS.map(tag => (
              <TouchableOpacity
                key={tag}
                onPress={() => toggleHashtag(tag)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                  backgroundColor: selectedHashtags.includes(tag) ? '#00A86B' : '#1a1a1a',
                  borderWidth: 1,
                  borderColor: selectedHashtags.includes(tag) ? '#00A86B' : '#333',
                }}
              >
                <Text style={{ color: selectedHashtags.includes(tag) ? '#fff' : '#888', fontSize: 12, fontWeight: '600' }}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* PARAMÈTRES */}
          <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 12 }}>Paramètres</Text>

          {/* Qui peut voir */}
          <TouchableOpacity onPress={() => setVisibility(v => v === 'public' ? 'friends' : v === 'friends' ? 'private' : 'public')} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name={visibility === 'public' ? 'earth' : visibility === 'friends' ? 'people' : 'lock-closed'} size={20} color="#888" />
              <Text style={{ color: '#fff', fontSize: 14 }}>Qui peut voir</Text>
            </View>
            <Text style={{ color: '#888', fontSize: 13 }}>
              {visibility === 'public' ? 'Tout le monde' : visibility === 'friends' ? 'Abonnés' : 'Moi seul'}
            </Text>
          </TouchableOpacity>

          {/* Commentaires */}
          <TouchableOpacity onPress={() => setCommentsEnabled(!commentsEnabled)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="chatbubble" size={20} color="#888" />
              <Text style={{ color: '#fff', fontSize: 14 }}>Commentaires</Text>
            </View>
            <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: commentsEnabled ? '#00A86B' : '#333', justifyContent: 'center', paddingHorizontal: 2 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', transform: [{ translateX: commentsEnabled ? 20 : 0 }] }} />
            </View>
          </TouchableOpacity>

          {/* Duo */}
          <TouchableOpacity onPress={() => setDuoEnabled(!duoEnabled)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="copy" size={20} color="#888" />
              <Text style={{ color: '#fff', fontSize: 14 }}>Duo</Text>
            </View>
            <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: duoEnabled ? '#00A86B' : '#333', justifyContent: 'center', paddingHorizontal: 2 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', transform: [{ translateX: duoEnabled ? 20 : 0 }] }} />
            </View>
          </TouchableOpacity>

          {/* Son sélectionné */}
          {selectedSound && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
              <Ionicons name="musical-notes" size={20} color="#00A86B" />
              <Text style={{ color: '#fff', fontSize: 14 }}>Son : {selectedSound}</Text>
            </View>
          )}
        </ScrollView>

        {/* UPLOADING OVERLAY */}
        {uploading && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#00A86B" />
              <Text style={{ color: colors.accent, fontSize: 24, fontWeight: '800', marginTop: 12 }}>{uploadProgress}%</Text>
              <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Publication...</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
