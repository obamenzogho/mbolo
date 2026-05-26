import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, Dimensions, Linking, Alert, Modal, StyleSheet, Pressable,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withDelay, withSequence, Easing, runOnJS,
} from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { openShare } from '../lib/socialShare'
import { colors } from '../lib/theme'
import { captureException } from '../lib/sentry'
import { useHaptics } from '../hooks/useHaptics'

const SCREEN_HEIGHT = Dimensions.get('window').height

export interface ShareVideoData {
  videoId: string
  videoURL: string
  description?: string
  onShareAction: () => Promise<void>
}

function ShareOption({ icon, label, onPress, index }: {
  icon: string; label: string; onPress: () => void; index: number
}) {
  const scale = useSharedValue(1)
  const entryScale = useSharedValue(0.6)
  const entryOpacity = useSharedValue(0)
  const { lightImpact } = useHaptics()

  useEffect(() => {
    entryScale.value = withDelay(index * 60, withSpring(1, { stiffness: 200, damping: 14 }))
    entryOpacity.value = withDelay(index * 60, withSpring(1, { stiffness: 200, damping: 14 }))
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * entryScale.value }],
    opacity: entryOpacity.value,
  }))

  const handlePress = useCallback(() => {
    lightImpact()
    scale.value = withSequence(
      withSpring(0.9, { stiffness: 500, damping: 12 }),
      withSpring(1, { stiffness: 400, damping: 15 }),
    )
    onPress()
  }, [onPress, lightImpact, scale])

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[{ alignItems: 'center', width: 72 }, animatedStyle]}>
        <View style={{
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name={icon as any} size={28} color={colors.white} />
        </View>
        <Text style={{ color: colors.white, fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center', lineHeight: 14 }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

export default function ShareModal({
  visible,
  onClose,
  data,
}: {
  visible: boolean
  onClose: () => void
  data: ShareVideoData | null
}) {
  const translateY = useSharedValue(SCREEN_HEIGHT)
  const backdropOpacity = useSharedValue(0)
  const [shareMessage, setShareMessage] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (visible && data) {
      backdropOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) })
      translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })
      setShareMessage(
        `${data.description ? data.description + '\n' : ''}Regarde cette vidéo sur Mbolo ! 🇬🇦\n${data.videoURL}`
      )
      setCopied(false)
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) })
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250, easing: Easing.out(Easing.cubic) })
    }
  }, [visible, data, translateY, backdropOpacity])

  const handleCopyLink = useCallback(async () => {
    if (!data) return
    await Clipboard.setStringAsync(data.videoURL)
    setCopied(true)
    await data.onShareAction()
    setTimeout(() => onClose(), 1200)
  }, [data, onClose])

  const handleWhatsApp = useCallback(() => {
    if (!data) return
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`
    Linking.openURL(url).catch(() => Alert.alert('Erreur', "WhatsApp n'est pas installé"))
    data.onShareAction()
  }, [data, shareMessage])

  const handleTwitter = useCallback(() => {
    if (!data) return
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`
    Linking.openURL(url).catch(() => Alert.alert('Erreur', "Impossible d'ouvrir Twitter"))
    data.onShareAction()
  }, [data, shareMessage])

  const handleSystemShare = useCallback(async () => {
    if (!data) return
    try {
      const result = await openShare({
        message: shareMessage,
        excludedActivityTypes: [
          'UIActivityTypeSaveToFiles',
          'UIActivityTypePrint',
          'UIActivityTypeAssignToContact',
          'UIActivityTypeAddToReadingList',
          'UIActivityTypeMarkupAsPDF',
        ],
      })
      if (result.success) {
        await data.onShareAction()
      }
    } catch (e) { console.warn('handleSystemShare error:', e) }
  }, [data, shareMessage])

  const handleInviteFriend = useCallback(async () => {
    if (!data) return
    const inviteMessage = `Rejoins-moi sur Mbolo !\n${data.videoURL}`
    try {
      const result = await openShare({ message: inviteMessage })
      if (result.success) {
        await data.onShareAction()
      }
    } catch (e) { console.warn('handleInviteFriend error:', e) }
  }, [data])

  const networkOptions = [
    { id: 'copy', label: 'Copier le lien', icon: 'link-outline' as const, action: handleCopyLink },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' as const, action: handleWhatsApp },
    { id: 'twitter', label: 'Twitter / X', icon: 'logo-twitter' as const, action: handleTwitter },
    { id: 'more', label: "Plus d'options", icon: 'ellipsis-horizontal-circle' as const, action: handleSystemShare },
  ]

  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY
      }
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 500) {
        runOnJS(onClose)()
      } else {
        translateY.value = withSpring(0, { damping: 40, stiffness: 300 })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: backdropOpacity }]}
        />
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#111111',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                maxHeight: SCREEN_HEIGHT * 0.55,
              },
              sheetStyle,
            ]}
          >
            <View style={{ alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
              <View style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: '#444', marginBottom: 8 }} />
              <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                <View style={{ width: 28 }} />
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.white }}>
                  Partager
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{ paddingVertical: 16, paddingHorizontal: 12 }} showsVerticalScrollIndicator={false}>
              <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 12, marginLeft: 4 }}>
                Partager avec tes amis
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 4 }}>
                <Pressable onPress={handleInviteFriend} style={{ alignItems: 'center', width: 56 }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary,
                    justifyContent: 'center', alignItems: 'center',
                  }}>
                    <Ionicons name="person-add-outline" size={24} color={colors.white} />
                  </View>
                  <Text style={{ color: colors.white, fontSize: 12, fontWeight: '600', marginTop: 6, textAlign: 'center' }}>Inviter</Text>
                </Pressable>
              </ScrollView>

              <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginTop: 24, marginBottom: 12, marginLeft: 4 }}>
                Réseaux disponibles
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 4 }}>
                {networkOptions.map((opt, index) => (
                  <ShareOption key={opt.id} icon={opt.icon} label={opt.label} onPress={opt.action} index={index} />
                ))}
              </ScrollView>
              <View style={{ height: 20 }} />
            </ScrollView>

            {copied && (
              <View style={{
                position: 'absolute', bottom: 20, left: 16, right: 16,
                backgroundColor: '#00A86B', borderRadius: 8, padding: 12,
                alignItems: 'center',
              }}>
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>✓ Lien copié !</Text>
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  )
}
