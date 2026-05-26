import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Image, Alert, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import type { Video as VideoType } from '@/types'

const SCREEN_WIDTH = Dimensions.get('window').width
const DEFAULT_SIZE = SCREEN_WIDTH / 3

interface VideoThumbnailCellProps {
  item: VideoType
  isOwn?: boolean
  size?: number
  onPress?: (videoId: string) => void
}

export function VideoThumbnailCell({ item, isOwn, size = DEFAULT_SIZE, onPress }: VideoThumbnailCellProps) {
  const router = useRouter()
  const [thumb, setThumb] = useState<string | null>(null)
  const [loading, setLoading] = useState(!item.thumbnailURL)

  useEffect(() => {
    if (item.thumbnailURL) { setThumb(item.thumbnailURL); setLoading(false); return }
    let cancelled = false
    const gen = async () => {
      try {
        const { uri } = await require('expo-video-thumbnails').getThumbnailAsync(item.videoURL, { time: 1000, quality: 0.5 })
        if (!cancelled) { setThumb(uri); setLoading(false) }
      } catch { if (!cancelled) setLoading(false) }
    }
    gen()
    return () => { cancelled = true }
  }, [item.videoURL, item.thumbnailURL])

  const handleLongPress = () => {
    if (!isOwn) return
    Alert.alert('Options vidéo', item.description || 'Aucune description', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Modifier description',
        onPress: async () => {
          const newDesc = prompt('Nouvelle description :', item.description)
          if (newDesc !== null) {
            try {
              await updateDoc(doc(db, 'videos', item.id), { description: newDesc })
            } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'editDesc' }) }
          }
        },
      },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'videos', item.id))
          } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'deleteVideo' }) }
        },
      },
    ])
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress ? onPress(item.id) : router.push({ pathname: '/(tabs)/feed', params: { videoId: item.id } })}
      onLongPress={handleLongPress}
      delayLongPress={500}
      style={{ width: size, height: size }}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} />
      ) : loading ? (
        <View style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="ellipsis-horizontal-outline" size={18} color="#444" />
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.4)" />
          {item.description ? (
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 6, paddingHorizontal: 6, textAlign: 'center', lineHeight: 13 }} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
      )}
      {item.type === 'reel' && (
        <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 }}>
          <Ionicons name="film-outline" size={12} color="#fff" />
        </View>
      )}
      {item.views !== undefined && item.views > 0 && (
        <View style={{ position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Ionicons name="play" size={10} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
            {item.views >= 1000 ? `${(item.views / 1000).toFixed(1)}K` : item.views}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}
