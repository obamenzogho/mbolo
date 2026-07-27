import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Linking from 'expo-linking'
import { auth } from '@/lib/firebase'
import { createShare, shareToDM } from '../services/shareService'
import { trackShareEvent } from '../analytics/shareAnalytics'
import type { ShareType } from '../types'
import { captureException } from '@/lib/sentry'

interface ShareVideoConfig {
  videoId: string
  videoURL: string
  description?: string
  thumbnailURL?: string
  userName?: string
}

export function useShare() {
  const [loading, setLoading] = useState(false)
  const currentUserId = auth.currentUser?.uid ?? ''

  const shareToDMAction = useCallback(async (
    receiverId: string,
    config: ShareVideoConfig,
  ) => {
    if (!currentUserId) return
    setLoading(true)
    try {
      await shareToDM(currentUserId, receiverId, config.videoId, config.videoURL, config.description)
      trackShareEvent({ videoId: config.videoId, shareType: 'DM_SHARE', senderId: currentUserId })
      return true
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'shareToDMAction' })
      return false
    } finally {
      setLoading(false)
    }
  }, [currentUserId])

  const copyLink = useCallback(async (config: ShareVideoConfig) => {
    if (!currentUserId) return
    const link = `https://mbolo.app/post/${config.videoId}`
    try {
      await Clipboard.setStringAsync(link)
      await createShare({ senderId: currentUserId, postId: config.videoId, shareType: 'COPY_LINK' })
      trackShareEvent({ videoId: config.videoId, shareType: 'COPY_LINK', senderId: currentUserId })
      return true
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'copyLink' })
      return false
    }
  }, [currentUserId])

  // Ouvre une URL cible ; si le lien n'est pas gérable (app absente, schéma
  // inconnu), on retombe sur la feuille de partage système pour que le bouton
  // fasse TOUJOURS quelque chose au lieu d'échouer en silence.
  const shareExternal = useCallback(async (url: string, config: ShareVideoConfig, fallbackText?: string) => {
    if (!currentUserId) return
    try {
      const canOpen = await Linking.canOpenURL(url).catch(() => false)
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        const { Share } = require('react-native')
        await Share.share({ message: fallbackText ?? config.videoURL, url: config.videoURL })
      }
      await createShare({ senderId: currentUserId, postId: config.videoId, shareType: 'EXTERNAL_SHARE' })
      trackShareEvent({ videoId: config.videoId, shareType: 'EXTERNAL_SHARE', senderId: currentUserId })
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'shareExternal' })
    }
  }, [currentUserId])

  const shareSystem = useCallback(async (config: ShareVideoConfig) => {
    if (!currentUserId) return
    try {
      const { Share } = require('react-native')
      await Share.share({
        message: config.description
          ? `🎬 ${config.description}\n\n${config.videoURL}`
          : `🎬 Regarde cette vidéo !\n\n${config.videoURL}`,
        url: config.videoURL,
      })
      await createShare({ senderId: currentUserId, postId: config.videoId, shareType: 'SYSTEM_SHARE' })
      trackShareEvent({ videoId: config.videoId, shareType: 'SYSTEM_SHARE', senderId: currentUserId })
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'shareSystem' })
    }
  }, [currentUserId])

  const buildText = (config: ShareVideoConfig) => {
    const link = config.videoURL || `https://mbolo.app/post/${config.videoId}`
    return config.description ? `🎬 ${config.description}\n${link}` : `🎬 Regarde ça !\n${link}`
  }

  const shareWhatsApp = useCallback((config: ShareVideoConfig) => {
    const text = buildText(config)
    // wa.me : lien universel qui ouvre l'app si installée, sinon WhatsApp Web.
    shareExternal(`https://wa.me/?text=${encodeURIComponent(text)}`, config, text)
  }, [shareExternal])

  const shareTelegram = useCallback((config: ShareVideoConfig) => {
    const link = config.videoURL || `https://mbolo.app/post/${config.videoId}`
    const text = config.description ? `🎬 ${config.description}` : '🎬 Regarde ça !'
    shareExternal(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
      config,
      buildText(config),
    )
  }, [shareExternal])

  const shareInstagramStory = useCallback((config: ShareVideoConfig) => {
    // Pas de partage web fiable côté Instagram → feuille système directement.
    shareExternal(`instagram-stories://share?source_application=mbolo`, config, buildText(config))
  }, [shareExternal])

  const shareX = useCallback((config: ShareVideoConfig) => {
    const text = buildText(config)
    shareExternal(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, config, text)
  }, [shareExternal])

  const shareSnapchat = useCallback((config: ShareVideoConfig) => {
    // Snapchat n'expose pas d'intent de partage de lien → feuille système.
    shareExternal(`snapchat://`, config, buildText(config))
  }, [shareExternal])

  const shareQRCode = useCallback(async (config: ShareVideoConfig) => {
    if (!currentUserId) return
    const link = `https://mbolo.app/post/${config.videoId}`
    const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(link)}`
    try {
      await Clipboard.setStringAsync(link)
      await createShare({ senderId: currentUserId, postId: config.videoId, shareType: 'COPY_LINK' })
      trackShareEvent({ videoId: config.videoId, shareType: 'COPY_LINK', senderId: currentUserId })
      Linking.openURL(qrURL)
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'shareQRCode' })
    }
  }, [currentUserId])

  return {
    loading,
    shareToDMAction,
    copyLink,
    shareSystem,
    shareWhatsApp,
    shareTelegram,
    shareInstagramStory,
    shareX,
    shareSnapchat,
    shareQRCode,
  }
}
