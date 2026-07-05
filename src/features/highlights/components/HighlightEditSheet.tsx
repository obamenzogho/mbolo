import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, TouchableOpacity, Image, TextInput,
  Alert, ScrollView, Dimensions, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as MediaLibrary from 'expo-media-library'
import * as FileSystem from 'expo-file-system'
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { auth } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { colors } from '@/lib/theme'
import { uploadToCloudinary } from '@/lib/cloudinary'
import {
  createHighlight,
  updateHighlight,
  deleteHighlight as deleteHighlightService,
} from '@/features/highlights/services/highlightService'
import type { Highlight } from '@/features/highlights/services/highlightService'

const SCREEN_WIDTH = Dimensions.get('window').width

interface HighlightEditSheetProps {
  visible: boolean
  onClose: () => void
  onSaved: () => void
  highlight?: Highlight | null
}

export default function HighlightEditSheet({ visible, onClose, onSaved, highlight }: HighlightEditSheetProps) {
  const [title, setTitle] = useState('')
  const [media, setMedia] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const sheetRef = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['90%'], [])

  const isEditing = !!highlight

  useEffect(() => {
    if (visible) {
      if (highlight) {
        setTitle(highlight.title || '')
        setMedia(highlight.mediaUrls || [])
      } else {
        setTitle('')
        setMedia([])
      }
      sheetRef.current?.expand()
    } else {
      sheetRef.current?.close()
    }
  }, [visible, highlight])

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) onClose()
  }, [onClose])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    [],
  )

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à vos photos et vidéos pour continuer.')
      return
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 1,
        selectionLimit: 10,
      })
      if (!result.canceled && result.assets.length > 0) {
        const localUris: string[] = []
        for (const asset of result.assets) {
          try {
            const info = await MediaLibrary.getAssetInfoAsync(asset.uri)
            const uri = info.localUri || asset.uri
            const ext = uri.split('.').pop() || (asset.type === 'video' ? 'mp4' : 'jpg')
            const documentDirectory = (FileSystem as any).documentDirectory || ''
            const localUri = documentDirectory + `media_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
            await FileSystem.copyAsync({ from: uri, to: localUri })
            localUris.push(localUri)
          } catch {
            localUris.push(asset.uri)
          }
        }
        setMedia(prev => [...prev, ...localUris])
      }
    } catch (e: any) {
      if (e?.message?.includes('PHPhotosErrorDomain') || e?.message?.includes('3164')) {
        Alert.alert('Vidéo non disponible', 'Cette vidéo est stockée dans iCloud. Téléchargez-la d\'abord sur votre appareil avant de l\'ajouter.')
      } else {
        Alert.alert('Erreur', 'Impossible de sélectionner ce média.')
      }
    }
  }

  const removeMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index))
  }

  const setCover = (index: number) => {
    setMedia(prev => {
      const arr = [...prev]
      const [item] = arr.splice(index, 1)
      return [item, ...arr]
    })
  }

  const uploadToCloudinary = async (uri: string): Promise<string | null> => {
    try {
      const isVideo = uri.includes('.mp4') || uri.includes('.mov') || uri.includes('.mkv') || uri.includes('.avi')
      const resourceType = isVideo ? 'video' : 'image'
      return await uploadToCloudinary(uri, resourceType)
    } catch (e) {
      console.error('Upload failed:', e)
      return null
    }
  }

  const save = async () => {
    if (!auth.currentUser || !title.trim() || media.length === 0) return
    setUploading(true)
    try {
      const existingUrls = media.filter(u => u.startsWith('http'))
      const newUris = media.filter(u => !u.startsWith('http'))
      const uploadedUrls: string[] = [...existingUrls]
      for (const uri of newUris) {
        const url = await uploadToCloudinary(uri)
        if (url) uploadedUrls.push(url)
        else {
          Alert.alert('Erreur', 'Impossible d\'uploader un fichier')
          setUploading(false)
          return
        }
      }
      if (isEditing && highlight) {
        await updateHighlight(highlight.id, {
          title: title.trim(),
          mediaUrls: uploadedUrls,
          coverUrl: uploadedUrls[0] || '',
        })
      } else {
        await createHighlight(title.trim(), uploadedUrls[0] || '', uploadedUrls)
      }
      onClose()
      onSaved()
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'saveHighlight' })
      Alert.alert('Erreur', 'Impossible de sauvegarder')
    }
    setUploading(false)
  }

  const handleDeleteHighlight = async () => {
    if (!isEditing || !highlight) return
    Alert.alert('Supprimer', 'Supprimer cette mise en avant ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await deleteHighlightService(highlight.id)
            onClose()
            onSaved()
          } catch (e) {
            captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteHighlight' })
          }
        }
      },
    ])
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      backdropComponent={renderBackdrop}
      handleStyle={{ backgroundColor: '#1a1a1a' }}
      handleIndicatorStyle={{ width: 40, height: 4, backgroundColor: '#444', borderRadius: 2 }}
      backgroundStyle={{ backgroundColor: '#1a1a1a' }}
      enablePanDownToClose
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* HEADER */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#333' }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: '700' }}>
            {isEditing ? 'Modifier' : 'Nouvelle mise en avant'}
          </Text>
          <TouchableOpacity
            onPress={save}
            disabled={uploading || !title.trim() || media.length === 0}
            style={{ padding: 4 }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ color: title.trim() && media.length > 0 ? colors.primary : '#444', fontSize: 16, fontWeight: '700' }}>
                Terminé
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          {/* COVER CIRCLE */}
          <TouchableOpacity onPress={media.length > 0 ? pickMedia : undefined} style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: '#333', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: '#111' }}>
              {media.length > 0 ? (
                <Image source={{ uri: media[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Ionicons name="add" size={36} color="#555" />
              )}
            </View>
            {media.length > 0 && (
              <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Modifier la couverture</Text>
            )}
          </TouchableOpacity>

          {/* TITLE */}
          <View style={{ width: '80%', marginBottom: 32 }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Nom de la mise en avant"
              placeholderTextColor="#555"
              maxLength={15}
              textAlign="center"
              style={{
                backgroundColor: 'transparent',
                color: '#fff',
                fontSize: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#333',
              }}
            />
          </View>

          {/* MEDIA */}
          <View style={{ width: '90%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#888', fontSize: 14, fontWeight: '600' }}>
                Contenu ({media.length})
              </Text>
              <TouchableOpacity onPress={pickMedia} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="add-circle" size={22} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Ajouter</Text>
              </TouchableOpacity>
            </View>

            {media.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {media.map((uri, i) => (
                  <View key={i} style={{ position: 'relative', width: (SCREEN_WIDTH * 0.9 - 8) / 3, aspectRatio: 1 }}>
                    <TouchableOpacity onPress={() => setCover(i)} activeOpacity={0.7}>
                      <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: 4 }} resizeMode="cover" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeMedia(i)}
                      style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                    {i === 0 && (
                      <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>COUV.</Text>
                      </View>
                    )}
                    {(uri.includes('.mp4') || uri.includes('.mov')) && (
                      <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2 }}>
                        <Ionicons name="videocam" size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                ))}
                {/* Add tile */}
                <TouchableOpacity
                  onPress={pickMedia}
                  style={{ width: (SCREEN_WIDTH * 0.9 - 8) / 3, aspectRatio: 1, borderRadius: 4, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }}
                >
                  <Ionicons name="add" size={28} color="#444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={pickMedia}
                style={{ height: 160, borderRadius: 12, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}
              >
                <Ionicons name="images" size={40} color="#333" />
                <Text style={{ color: '#555', fontSize: 13, marginTop: 6 }}>
                  Ajouter du contenu
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* DELETE */}
          {isEditing && (
            <TouchableOpacity
              onPress={handleDeleteHighlight}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 40 }}
            >
              <Ionicons name="trash" size={18} color={colors.error} />
              <Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>
                Supprimer la mise en avant
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}
