import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, Image, Alert,
  Platform, ScrollView, Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { doc, getDoc, runTransaction, updateDoc } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import OrbitLoader from '../../src/components/OrbitLoader'
import { uploadToCloudinary } from '../../src/lib/cloudinary'
import { captureException } from '../../src/lib/sentry'
import { useUsernameCheck } from '../../src/hooks/useUsernameCheck'
import { CollapsibleSection } from '../../src/components/profile/CollapsibleSection'
import { FieldWithCounter } from '../../src/components/profile/FieldWithCounter'
import { ProfilePreview } from '../../src/components/profile/ProfilePreview'

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
  const [currentPseudo, setCurrentPseudo] = useState('')
  const [editing, setEditing] = useState(false)
  const [activeField, setActiveField] = useState<string | null>(null)
  const [kbHeight, setKbHeight] = useState(0)
  const focusCount = useRef(0)
  const scrollRef = useRef<ScrollView>(null)
  const scrollOff = useRef(0)
  const fieldRefs = useRef<Record<string, View | null>>({})

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  const scrollToField = useCallback((field: string) => {
    const node = fieldRefs.current[field]
    if (!node) return
    requestAnimationFrame(() => {
      node.measureInWindow((_fx, fy) => {
        scrollRef.current?.measureInWindow((_sx, sy) => {
          const contentY = fy - sy + scrollOff.current
          scrollRef.current?.scrollTo({ y: Math.max(0, contentY - 120), animated: true })
        })
      })
    })
  }, [])

  const onFieldFocus = useCallback((field: string) => {
    focusCount.current++
    setEditing(true)
    setActiveField(field)
    scrollToField(field)
  }, [scrollToField])

  const onFieldBlur = useCallback(() => {
    focusCount.current = Math.max(0, focusCount.current - 1)
    if (focusCount.current === 0) { setEditing(false); setActiveField(null) }
  }, [])

  const previewProps = { nom, pseudo, bio, photoURL, externalLink }
  const usernameStatus = useUsernameCheck(pseudo, currentPseudo)

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'users', user.uid)).then((snap: any) => {
      if (snap.exists()) {
        const d = snap.data()
        setNom(d.nom || '')
        setPseudo(d.pseudo || '')
        setCurrentPseudo(d.pseudo || '')
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
      const url = await uploadToCloudinary(uri, 'image', { compress: true, quality: 0.8 })
      await updateDoc(doc(db, 'users', user!.uid), { photoURL: url })
      setPhotoURL(url)
    } catch (e) {
      console.warn('[UPLOAD PHOTO]', e)
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'pickAndUploadPhoto' })
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
    if (usernameStatus === 'taken') {
      Alert.alert('Pseudo indisponible', 'Ce nom d\'utilisateur est déjà pris.')
      return
    }
    const newPseudo = pseudo.trim().toLowerCase()
    setSaving(true)
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await tx.get(userRef)
        const oldPseudo = (userSnap.data()?.pseudo || '').toLowerCase()

        if (newPseudo !== oldPseudo) {
          const newRef = doc(db, 'usernames', newPseudo)
          const newSnap = await tx.get(newRef)
          if (newSnap.exists() && newSnap.data()?.uid !== user.uid) {
            throw new Error('PSEUDO_TAKEN')
          }
          tx.set(newRef, { uid: user.uid })
          if (oldPseudo) tx.delete(doc(db, 'usernames', oldPseudo))
        }

        tx.update(userRef, {
          nom: nom.trim(),
          pseudo: newPseudo,
          pseudoLower: newPseudo,
          bio: bio.trim(),
          photoURL,
          showAge,
          privateAccount,
          genre: genre || '',
          externalLink: externalLink.trim(),
        })
      })
      Alert.alert('Succès', 'Profil mis à jour', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile') },
      ])
    } catch (e: any) {
      if (e?.message === 'PSEUDO_TAKEN') {
        Alert.alert('Pseudo indisponible', 'Ce nom d\'utilisateur est déjà pris.')
      } else {
        Alert.alert('Erreur', 'Impossible de sauvegarder')
      }
    }
    setSaving(false)
  }



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
            <OrbitLoader size={20} />
          ) : (
            <Ionicons name="save-outline" size={22} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24, paddingBottom: kbHeight || 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={(e) => { scrollOff.current = e.nativeEvent.contentOffset.y }}
          onScrollBeginDrag={() => { setEditing(false); setActiveField(null); focusCount.current = 0 }}
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
                <OrbitLoader size={20} />
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

          <CollapsibleSection title="Informations personnelles" icon="person-outline">
            {editing && activeField === 'nom' && <ProfilePreview {...previewProps} />}
            <View ref={(el) => { fieldRefs.current['nom'] = el }}>
              <FieldWithCounter label="Nom complet" value={nom} onChangeText={setNom} maxLength={40} placeholder="Ton nom" onFocus={() => onFieldFocus('nom')} onBlur={onFieldBlur} />
            </View>
            {editing && activeField === 'pseudo' && <ProfilePreview {...previewProps} />}
            <View ref={(el) => { fieldRefs.current['pseudo'] = el }}>
              <FieldWithCounter label="Nom d'utilisateur" value={pseudo} onChangeText={setPseudo} maxLength={30} autoCapitalize="none" placeholder="pseudo" onFocus={() => onFieldFocus('pseudo')} onBlur={onFieldBlur} />
            </View>
            {usernameStatus === 'checking' && (
              <Text style={{ color: '#888', fontSize: 12, marginTop: -8 }}>Vérification...</Text>
            )}
            {usernameStatus === 'available' && (
              <Text style={{ color: '#4CAF50', fontSize: 12, marginTop: -8 }}>Disponible</Text>
            )}
            {usernameStatus === 'taken' && (
              <Text style={{ color: '#F44336', fontSize: 12, marginTop: -8 }}>Ce pseudo est déjà pris</Text>
            )}
            {usernameStatus === 'invalid' && (
              <Text style={{ color: '#FF9800', fontSize: 12, marginTop: -8 }}>Min. 3 caractères, lettres/chiffres/./_ uniquement</Text>
            )}
            {editing && activeField === 'bio' && <ProfilePreview {...previewProps} />}
            <View ref={(el) => { fieldRefs.current['bio'] = el }}>
              <FieldWithCounter label="Bio" value={bio} onChangeText={setBio} maxLength={150} multiline placeholder="Parle un peu de toi" onFocus={() => onFieldFocus('bio')} onBlur={onFieldBlur} />
            </View>
          </CollapsibleSection>

          <CollapsibleSection title="Liens & réseaux" icon="link-outline">
            {editing && activeField === 'externalLink' && <ProfilePreview {...previewProps} />}
            <View ref={(el) => { fieldRefs.current['externalLink'] = el }}>
              <FieldWithCounter label="Lien externe" value={externalLink} onChangeText={setExternalLink} autoCapitalize="none" keyboardType="url" placeholder="https://..." onFocus={() => onFieldFocus('externalLink')} onBlur={onFieldBlur} />
            </View>
          </CollapsibleSection>

          <CollapsibleSection title="Genre" icon="people-outline" defaultOpen={false}>
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
          </CollapsibleSection>

          <CollapsibleSection title="Confidentialité" icon="lock-closed-outline" defaultOpen={false}>
            <TouchableOpacity
              onPress={() => setShowAge(!showAge)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
                borderWidth: 1, borderColor: '#333',
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
            <TouchableOpacity
              onPress={() => setPrivateAccount(!privateAccount)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14,
                borderWidth: 1, borderColor: '#333',
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
          </CollapsibleSection>
        </ScrollView>
    </SafeAreaView>
  )
}
