import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Image, Alert,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import OrbitLoader from '../../src/components/OrbitLoader'

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET

export default function EditProfile() {
  const user = auth.currentUser
  const [nom, setNom] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [bio, setBio] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [showAge, setShowAge] = useState(true)
  const [externalLink, setExternalLink] = useState('')
  const [privateAccount, setPrivateAccount] = useState(false)
  const [genre, setGenre] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid)).then((snap: any) => {
      if (snap.exists()) {
        const d = snap.data()
        setNom(d.nom || '')
        setPseudo(d.pseudo || '')
        setBio(d.bio || '')
        setPhotoURL(d.photoURL || '')
        setShowAge(d.showAge !== false)
        setExternalLink(d.externalLink || '')
        setPrivateAccount(d.privateAccount || false)
        setGenre(d.genre || null)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user])

  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const pickAndUploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return

    setUploadingPhoto(true)
    try {
      const uri = result.assets[0].uri
      const formData = new FormData()
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any)
      formData.append('upload_preset', UPLOAD_PRESET || '')
      formData.append('folder', 'profile_photos')

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      )
      const data = await res.json()
      if (data.secure_url) {
        await updateDoc(doc(db, 'users', user!.uid), { photoURL: data.secure_url })
        setPhotoURL(data.secure_url)
      }
    } catch {
      Alert.alert('Erreur', "Impossible d'uploader la photo")
    }
    setUploadingPhoto(false)
  }

  const handleSave = async () => {
    if (!user) return
    if (!nom.trim() || !pseudo.trim()) {
      Alert.alert('Erreur', 'Nom et pseudo sont obligatoires')
      return
    }
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        nom: nom.trim(),
        pseudo: pseudo.trim().toLowerCase(),
        bio: bio.trim(),
        photoURL,
        showAge,
        privateAccount,
        genre: genre || '',
        externalLink: externalLink.trim(),
      })
      Alert.alert('Succès', 'Profil mis à jour', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile') },
      ])
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder')
    }
    setSaving(false)
  }

  const inputStyle = (focused: boolean) => ({
    backgroundColor: '#111',
    color: colors.white,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: focused ? colors.primary : '#333',
  })

  const [focusedField, setFocusedField] = useState<string | null>(null)

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      {/* HEADER */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={{ width: 36, height: 36, justifyContent: 'center' }}>
          <Ionicons name="close" size={26} color={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>Modifier le profil</Text>
        </View>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-end' }}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="save-outline" size={22} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* PHOTO */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.primary, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={{ width: 94, height: 94, borderRadius: 47 }} />
              ) : (
                <Ionicons name="camera" size={36} color="#555" />
              )}
            </View>
            <TouchableOpacity onPress={pickAndUploadPhoto} disabled={uploadingPhoto} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="camera-outline" size={16} color={colors.primary} />
              )}
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Changer la photo</Text>
            </TouchableOpacity>
            {photoURL ? (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Supprimer la photo', 'Tu veux vraiment supprimer ta photo de profil ?', [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Supprimer',
                      style: 'destructive',
                      onPress: async () => {
                        await updateDoc(doc(db, 'users', user!.uid), { photoURL: '' })
                        setPhotoURL('')
                      },
                    },
                  ])
                }}
                style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>Supprimer la photo</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* NOM COMPLET */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#888', fontSize: 13, marginBottom: 6, fontWeight: '600' }}>Nom complet</Text>
            <TextInput
              value={nom}
              onChangeText={setNom}
              placeholder="Ton nom"
              placeholderTextColor="#555"
              style={inputStyle(focusedField === 'nom')}
              onFocus={() => setFocusedField('nom')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* NOM D'UTILISATEUR */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#888', fontSize: 13, marginBottom: 6, fontWeight: '600' }}>Nom d'utilisateur</Text>
            <TextInput
              value={pseudo}
              onChangeText={setPseudo}
              placeholder="@nomutilisateur"
              placeholderTextColor="#555"
              autoCapitalize="none"
              style={inputStyle(focusedField === 'pseudo')}
              onFocus={() => setFocusedField('pseudo')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* BIO */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#888', fontSize: 13, marginBottom: 6, fontWeight: '600' }}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Parle un peu de toi..."
              placeholderTextColor="#555"
              multiline
              numberOfLines={3}
              maxLength={150}
              style={[inputStyle(focusedField === 'bio'), { minHeight: 60, textAlignVertical: 'top' }]}
              onFocus={() => setFocusedField('bio')}
              onBlur={() => setFocusedField(null)}
            />
            <Text style={{ color: '#555', fontSize: 11, textAlign: 'right', marginTop: 4 }}>{bio.length}/150</Text>
          </View>

          {/* LIEN EXTERNE */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#888', fontSize: 13, marginBottom: 6, fontWeight: '600' }}>Lien externe</Text>
            <TextInput
              value={externalLink}
              onChangeText={setExternalLink}
              placeholder="https://ton-site.com"
              placeholderTextColor="#555"
              keyboardType="url"
              autoCapitalize="none"
              style={inputStyle(focusedField === 'externalLink')}
              onFocus={() => setFocusedField('externalLink')}
              onBlur={() => setFocusedField(null)}
            />
            <Text style={{ color: '#555', fontSize: 11, marginTop: 4 }}>Apparaîtra sur ton profil</Text>
          </View>

          {/* GENRE */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#888', fontSize: 13, marginBottom: 8, fontWeight: '600' }}>Genre</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { key: 'homme', label: 'Homme', icon: 'man-outline' },
                { key: 'femme', label: 'Femme', icon: 'woman-outline' },
                { key: 'non-binaire', label: 'Non-binaire', icon: 'people-outline' },
                { key: 'prefere-ne-pas-dire', label: 'Préfère ne pas dire', icon: 'help-outline' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setGenre(genre === option.key ? null : option.key)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                    backgroundColor: genre === option.key ? colors.primary : '#111',
                    borderWidth: 1,
                    borderColor: genre === option.key ? colors.primary : '#333',
                  }}
                >
                  <Ionicons name={option.icon as any} size={18} color={genre === option.key ? colors.white : '#888'} />
                  <Text style={{ color: genre === option.key ? colors.white : colors.text, fontSize: 13, fontWeight: '600' }}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* AFFICHER L'ÂGE */}
          <TouchableOpacity
            onPress={() => setShowAge(!showAge)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
              borderWidth: 1, borderColor: '#333', marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="eye-outline" size={20} color="#888" />
              <Text style={{ color: colors.white, fontSize: 15 }}>Afficher mon âge</Text>
            </View>
            <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: showAge ? colors.primary : '#333', justifyContent: 'center', padding: 2 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', transform: [{ translateX: showAge ? 20 : 0 }] }} />
            </View>
          </TouchableOpacity>

          {/* COMPTE PRIVÉ */}
          <TouchableOpacity
            onPress={() => setPrivateAccount(!privateAccount)}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
              borderWidth: 1, borderColor: '#333', marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="lock-closed-outline" size={20} color="#888" />
              <Text style={{ color: colors.white, fontSize: 15 }}>Compte privé</Text>
            </View>
            <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: privateAccount ? colors.primary : '#333', justifyContent: 'center', padding: 2 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', transform: [{ translateX: privateAccount ? 20 : 0 }] }} />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
