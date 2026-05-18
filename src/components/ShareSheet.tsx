import { useCallback, useRef, useMemo, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Share, Linking, Platform, Clipboard } from 'react-native'
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'

interface ShareOption {
  id: string
  label: string
  icon: string
  color: string
  action: () => void | Promise<void>
}

interface ShareSheetProps {
  visible: boolean
  onClose: () => void
  mediaUri?: string
  postUrl?: string
  postId?: string
}

export default function ShareSheet({ visible, onClose, mediaUri, postUrl, postId }: ShareSheetProps) {
  const sheetRef = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ['55%'], [])

  useEffect(() => {
    if (visible) {
      sheetRef.current?.expand()
    } else {
      sheetRef.current?.close()
    }
  }, [visible])

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) onClose()
  }, [onClose])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  )

  const handleCopyLink = useCallback(async () => {
    const url = postUrl || `https://mbolo.app/post/${postId}`
    try {
      await Clipboard.setStringAsync(url)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Copié !', 'Le lien a été copié dans le presse-papiers.')
      sheetRef.current?.close()
    } catch {
      Alert.alert('Erreur', 'Impossible de copier le lien.')
    }
  }, [postUrl, postId])

  const handleShareMessage = useCallback(async () => {
    const url = postUrl || `https://mbolo.app/post/${postId}`
    try {
      const result = await Share.share({
        message: `Regarde cette vidéo sur Mbolo ! ${url}`,
        title: 'Partager sur Mbolo',
      })
      if (result.action === Share.shared) {
        sheetRef.current?.close()
      }
    } catch {}
  }, [postUrl, postId])

  const handleShareWhatsApp = useCallback(async () => {
    const url = postUrl || `https://mbolo.app/post/${postId}`
    const text = encodeURIComponent(`Regarde cette vidéo sur Mbolo ! ${url}`)
    const waUrl = `whatsapp://send?text=${text}`
    try {
      const canOpen = await Linking.canOpenURL(waUrl)
      if (canOpen) {
        await Linking.openURL(waUrl)
        sheetRef.current?.close()
      } else {
        Alert.alert('Erreur', 'WhatsApp n\'est pas installé sur cet appareil.')
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp.')
    }
  }, [postUrl, postId])

  const handleDownload = useCallback(async () => {
    if (!mediaUri) {
      Alert.alert('Erreur', 'Aucune média à télécharger.')
      return
    }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Mbolo a besoin d\'accéder à ta galerie pour sauvegarder ce média.')
        return
      }
      Alert.alert(
        'Télécharger',
        'Voulez-vous sauvegarder cette vidéo/photo dans votre galerie ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Sauvegarder',
            onPress: async () => {
              try {
                const filename = `mbolo_${Date.now()}.${mediaUri.includes('.mp4') ? 'mp4' : 'jpg'}`
                const fileUri = `${FileSystem.documentDirectory}${filename}`
                await FileSystem.copyAsync({ from: mediaUri, to: fileUri })
                const asset = await MediaLibrary.createAssetAsync(fileUri)
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                Alert.alert('Succès', 'Média sauvegardé dans votre galerie !')
                sheetRef.current?.close()
              } catch (e) {
                console.error('Download error:', e)
                Alert.alert('Erreur', 'Impossible de télécharger le média.')
              }
            },
          },
        ]
      )
    } catch {
      Alert.alert('Erreur', 'Impossible d\'accéder à la galerie.')
    }
  }, [mediaUri])

  const handleReport = useCallback(() => {
    Alert.alert(
      'Signaler',
      'Pourquoi signales-tu cette publication ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Contenu inapproprié', onPress: () => Alert.alert('Merci', 'Signalement envoyé. Nous allons examiner ce contenu.') },
        { text: 'Harcèlement', onPress: () => Alert.alert('Merci', 'Signalement envoyé. Nous allons examiner ce contenu.') },
        { text: 'Faux informations', onPress: () => Alert.alert('Merci', 'Signalement envoyé. Nous allons examiner ce contenu.') },
        { text: 'Spam', onPress: () => Alert.alert('Merci', 'Signalement envoyé. Nous allons examiner ce contenu.') },
      ]
    )
    sheetRef.current?.close()
  }, [postId])

  const options: ShareOption[] = [
    { id: 'copy', label: 'Copier le lien', icon: 'link', color: '#888', action: handleCopyLink },
    { id: 'message', label: 'Envoyer en message', icon: 'chatbubble-ellipses', color: '#00A86B', action: handleShareMessage },
    { id: 'whatsapp', label: 'Partager sur WhatsApp', icon: 'logo-whatsapp', color: '#25D366', action: handleShareWhatsApp },
    { id: 'download', label: 'Télécharger la vidéo', icon: 'download', color: '#FCD116', action: handleDownload },
    { id: 'report', label: 'Signaler', icon: 'flag', color: '#FF4444', action: handleReport },
  ]

  if (!visible) return null

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      onChange={handleSheetChanges}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Partager</Text>

        <View style={styles.options}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                option.action()
              }}
              style={styles.option}
            >
              <View style={[styles.iconCircle, { backgroundColor: option.color + '20' }]}>
                <Ionicons name={option.icon as any} size={22} color={option.color} />
              </View>
              <Text style={styles.optionLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: '#444',
    width: 40,
  },
  container: {
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  option: {
    alignItems: 'center',
    width: '30%',
    marginBottom: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
})