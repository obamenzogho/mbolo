import { useCallback, useMemo, useEffect } from 'react'
import { Modal, View, Text, TouchableOpacity, Dimensions, Keyboard } from 'react-native'
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  interpolate,
  type PanGestureHandlerGestureEvent,
} from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ShareUserCard } from './ShareUserCard'
import { ShareSearchBar } from './ShareSearchBar'
import { ShareActions } from './ShareActions'
import { useShare } from '../hooks/useShare'
import { useShareSearch } from '../hooks/useShareSearch'
import { useShareStore } from '../store/shareStore'
import OrbitLoader from '@/components/OrbitLoader'
import { auth } from '@/lib/firebase'
import type { ShareSuggestion } from '../types'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

interface ShareModalProps {
  visible: boolean
  onClose: () => void
  preloadedSuggestions?: ShareSuggestion[]
  suggestionsLoading?: boolean
}

export default function ShareModal({
  visible,
  onClose,
  preloadedSuggestions = [],
  suggestionsLoading = false,
}: ShareModalProps) {
  const insets = useSafeAreaInsets()
  const currentUserId = auth.currentUser?.uid ?? ''
  const showToast = useShareStore((s) => s.showToast)
  const shareVideo = useShareStore((s) => s.shareVideo)

  const translateY = useSharedValue(SCREEN_HEIGHT)
  const backdropOpacity = useSharedValue(0)
  const keyboardOffset = useSharedValue(0)

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      keyboardOffset.value = withTiming(-e.endCoordinates.height, { duration: 250, easing: Easing.out(Easing.cubic) })
    })
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      keyboardOffset.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) })
    })
    return () => { showSub.remove(); hideSub.remove() }
  }, [keyboardOffset])

  const {
    shareToDMAction,
    copyLink,
    shareSystem,
    shareWhatsApp,
    shareTelegram,
    shareInstagramStory,
    shareX,
    shareSnapchat,
    shareQRCode,
  } = useShare()

  const { query, results: searchResults, loading: searchLoading, search, clear: clearSearch } =
    useShareSearch(currentUserId)

  const config = useMemo(() => ({
    videoId: shareVideo?.id ?? '',
    videoURL: shareVideo?.url ?? '',
    description: shareVideo?.description,
    thumbnailURL: shareVideo?.thumbnailURL,
    userName: shareVideo?.userName,
  }), [shareVideo])

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) })
      backdropOpacity.value = withTiming(0.7, { duration: 200 })
    } else {
      translateY.value = SCREEN_HEIGHT
      backdropOpacity.value = 0
    }
  }, [visible, translateY, backdropOpacity])

  const handleClose = useCallback(() => {
    clearSearch()
    onClose()
  }, [clearSearch, onClose])

  const handleUserPress = useCallback(async (receiverId: string) => {
    const success = await shareToDMAction(receiverId, config)
    if (success) {
      showToast('Vidéo envoyée !')
      handleClose()
    }
  }, [shareToDMAction, config, showToast, handleClose])

  const handleCopyLink = useCallback(async () => {
    const success = await copyLink(config)
    if (success) {
      showToast('Lien copié !')
      handleClose()
    }
  }, [copyLink, config, showToast, handleClose])

  const handleSystemShare = useCallback(() => {
    shareSystem(config)
    handleClose()
  }, [shareSystem, config, handleClose])

  const handleWapress = useCallback(() => {
    shareWhatsApp(config)
    handleClose()
  }, [shareWhatsApp, config, handleClose])

  const handleTgpress = useCallback(() => {
    shareTelegram(config)
    handleClose()
  }, [shareTelegram, config, handleClose])

  const handleIspress = useCallback(() => {
    shareInstagramStory(config)
    handleClose()
  }, [shareInstagramStory, config, handleClose])

  const handleXpress = useCallback(() => {
    shareX(config)
    handleClose()
  }, [shareX, config, handleClose])

  const handleSnappress = useCallback(() => {
    shareSnapchat(config)
    handleClose()
  }, [shareSnapchat, config, handleClose])

  const handleQRpress = useCallback(() => {
    shareQRCode(config)
    handleClose()
  }, [shareQRCode, config, handleClose])

  const handleShareToActus = useCallback(() => {
    handleClose()
    const url = config.videoURL || `https://mbolo.app/post/${config.videoId}`
    router.push({
      pathname: '/news-compose',
      params: { sharedUrl: url },
    })
  }, [config, handleClose])

  const panGesture = Gesture.Pan()
    .onUpdate((e: PanGestureHandlerGestureEvent['nativeEvent']) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY
        backdropOpacity.value = interpolate(e.translationY, [0, SCREEN_HEIGHT], [0.7, 0])
      }
    })
    .onEnd((e: PanGestureHandlerGestureEvent['nativeEvent']) => {
      if (e.translationY > 120 || e.velocityY > 500) {
        runOnJS(handleClose)()
      } else {
        translateY.value = withTiming(0, { duration: 200 })
        backdropOpacity.value = withTiming(0.7, { duration: 100 })
      }
    })

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + keyboardOffset.value }],
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const displayData = query.length > 0 ? searchResults : preloadedSuggestions

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        <Reanimated.View style={[{ flex: 1, backgroundColor: '#000' }, backdropStyle]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        </Reanimated.View>

        <GestureDetector gesture={panGesture}>
          <Reanimated.View style={[{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: SCREEN_HEIGHT - insets.top - 40,
            backgroundColor: '#0D1117',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }, panelStyle]}>
            <View style={{ flex: 1 }}>
              <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444' }} />
              </View>

              <View style={[{ paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#222' }, { paddingTop: insets.top > 0 ? 4 : 8 }]}>
                <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '700' }}>Partager</Text>
              </View>

              <ShareActions
                actions={[
                  { icon: 'link', label: 'Copier le lien', onPress: handleCopyLink, color: '#00C853' },
                  { icon: 'newspaper-outline', label: 'Actus', onPress: handleShareToActus, color: '#F7B928' },
                  { icon: 'qr-code', label: 'QR Code', onPress: handleQRpress, color: '#8B5CF6' },
                  { icon: 'logo-whatsapp', label: 'WhatsApp', onPress: handleWapress, color: '#25D366' },
                  { icon: 'send', label: 'Telegram', onPress: handleTgpress, color: '#0088CC' },
                  { icon: 'logo-instagram', label: 'Instagram', onPress: handleIspress, color: '#E4405F' },
                  { icon: 'logo-twitter', label: 'X', onPress: handleXpress, color: '#FFFFFF' },
                  { icon: 'logo-snapchat', label: 'Snapchat', onPress: handleSnappress, color: '#FFFC00' },
                  { icon: 'ellipsis-horizontal', label: 'Plus d\'options', onPress: handleSystemShare, color: '#3A75C4' },
                ]}
              />

              <ShareSearchBar
                value={query}
                onChangeText={search}
                onClear={clearSearch}
                placeholder="Rechercher un ami..."
              />

              {query.length === 0 && preloadedSuggestions.length > 0 && (
                <Text style={{
                  color: '#888', fontSize: 13, fontWeight: '600',
                  textTransform: 'uppercase', letterSpacing: 1,
                  paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
                }}>
                  Suggestions
                </Text>
              )}

              <Reanimated.ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {searchLoading || suggestionsLoading ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <OrbitLoader size={20} />
                  </View>
                ) : displayData.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Ionicons name="people-outline" size={32} color="#444" />
                    <Text style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
                      {query.length > 0 ? 'Aucun utilisateur trouvé' : 'Aucune suggestion'}
                    </Text>
                  </View>
                ) : (
                  displayData.map((item: any) => (
                    <ShareUserCard
                      key={item.userId || item.id}
                      id={item.userId || item.id}
                      pseudo={item.pseudo}
                      nom={item.nom}
                      reason={item.reason}
                      onPress={handleUserPress}
                    />
                  ))
                )}
              </Reanimated.ScrollView>
            </View>
          </Reanimated.View>
        </GestureDetector>
      </View>
    </Modal>
  )
}
