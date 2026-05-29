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
    const link = `mbolo://post/${config.videoId}`
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

  const shareExternal = useCallback(async (url: string, config: ShareVideoConfig) => {
    if (!currentUserId) return
    try {
      await Linking.openURL(url)
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

  const shareWhatsApp = useCallback((config: ShareVideoConfig) => {
    const text = config.description
      ? `🎬 ${config.description}\n${config.videoURL}`
      : `🎬 Regarde ça !\n${config.videoURL}`
    shareExternal(`whatsapp://send?text=${encodeURIComponent(text)}`, config)
  }, [shareExternal])

  const shareTelegram = useCallback((config: ShareVideoConfig) => {
    const text = config.description
      ? `🎬 ${config.description}\n${config.videoURL}`
      : `🎬 Regarde ça !\n${config.videoURL}`
    shareExternal(`tg://msg?text=${encodeURIComponent(text)}`, config)
  }, [shareExternal])

  const shareInstagramStory = useCallback((config: ShareVideoConfig) => {
    shareExternal(`instagram-stories://share?source_application=mbolo`, config)
  }, [shareExternal])

  const shareX = useCallback((config: ShareVideoConfig) => {
    const text = config.description
      ? `🎬 ${config.description}\n${config.videoURL}`
      : `🎬 Regarde ça !\n${config.videoURL}`
    shareExternal(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, config)
  }, [shareExternal])

  const shareSnapchat = useCallback((config: ShareVideoConfig) => {
    shareExternal(`snapchat://`, config)
  }, [shareExternal])

  const shareQRCode = useCallback(async (config: ShareVideoConfig) => {
    if (!currentUserId) return
    const link = `mbolo://post/${config.videoId}`
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
