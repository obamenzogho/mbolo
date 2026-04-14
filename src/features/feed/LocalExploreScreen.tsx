/* LocalExploreScreen — onglet « ville / à proximité » présenté en GRILLE de
   cards (façon Explore Instagram). Les données viennent de useLocalFeedData
   (proximité + complément tendances). Au tap sur une card, on ouvre la vidéo
   en plein écran vertical (ProfileVideoViewer), exactement comme « Pour toi »,
   avec toute la liste locale pour pouvoir scroller de vidéo en vidéo. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, Dimensions, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { generateThumbnailURL } from '../../lib/cloudinary'
import { colors } from '../../lib/theme'
import { useTabBarVisibility } from '../../contexts/TabBarVisibilityContext'
import { localFeedStore } from './store/feedStore'
import { useLocalFeedData } from './hooks/useLocalFeedData'
import { ProfileVideoViewer } from './profile-viewer/ProfileVideoViewer'
import { auth } from '../../lib/firebase'
import type { Place } from '../location/useUserLocation'
import type { Video } from '../../types'

const SCREEN_WIDTH = Dimensions.get('window').width
const COLS = 2
const GAP = 8
const H_PADDING = 12
const CARD_W = (SCREEN_WIDTH - H_PADDING * 2 - GAP * (COLS - 1)) / COLS
const CARD_H = CARD_W * 1.4 // ratio portrait façon Explore

function ExploreCard({ item, onPress }: { item: Video; onPress: (id: string) => void }) {
  const thumb = item.thumbnailURL ?? generateThumbnailURL(item.videoURL) ?? undefined
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onPress(item.id)} style={s.card}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.cardFallback]}>
          <Ionicons name="play-circle" size={30} color="rgba(255,255,255,0.4)" />
        </View>
      )}
      <View style={s.cardGradient} />
      <View style={s.cardMeta}>
        <Ionicons name="play" size={12} color="#fff" />
        <Text style={s.cardMetaText}>{formatCount(item.views ?? item.likes ?? 0)}</Text>
      </View>
      {item.place ? (
        <View style={s.cardPlace}>
          <Ionicons name="location-sharp" size={10} color="#fff" />
          <Text numberOfLines={1} style={s.cardPlaceText}>{item.place}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

interface LocalExploreScreenProps {
  place: Place | null
  cityLabel: string
}

export default function LocalExploreScreen({ place, cityLabel }: LocalExploreScreenProps) {
  const insets = useSafeAreaInsets()
  const { videos, isLoadingMore, refresh } = useLocalFeedData({ store: localFeedStore, place })
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const { showTabBar } = useTabBarVisibility()

  // L'onglet ville n'affiche qu'une grille de cards (aucune vidéo en lecture) :
  // la navbar doit toujours rester visible tant que le viewer plein écran n'est
  // pas ouvert. On la restaure au cas où un autre écran l'aurait masquée.
  useEffect(() => {
    if (viewerIndex === null) showTabBar()
  }, [viewerIndex, videos, showTabBar])

  const openViewer = useCallback((id: string) => {
    const idx = videos.findIndex((v) => v.id === id)
    if (idx !== -1) setViewerIndex(idx)
  }, [videos])

  const renderItem = useCallback(
    ({ item }: { item: Video }) => <ExploreCard item={item} onPress={openViewer} />,
    [openViewer],
  )

  const header = useMemo(() => (
    <View style={{ paddingTop: insets.top + 64, paddingHorizontal: H_PADDING, paddingBottom: 12 }}>
      <Text style={s.title}>Tendances près de toi</Text>
      <Text style={s.subtitle}>
        {place ? `À ${cityLabel} et aux alentours` : 'Active ta position pour voir les tendances locales'}
      </Text>
    </View>
  ), [insets.top, place, cityLabel])

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: H_PADDING }}
        contentContainerStyle={{ gap: GAP, paddingBottom: insets.bottom + 90 }}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoadingMore} onRefresh={refresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          !isLoadingMore ? (
            <View style={s.empty}>
              <Ionicons name="location-outline" size={44} color="#444" />
              <Text style={s.emptyText}>Aucune vidéo près de toi pour l'instant</Text>
            </View>
          ) : null
        }
      />

      {viewerIndex !== null && (
        <ProfileVideoViewer
          videos={videos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          userId={auth.currentUser?.uid || ''}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: '#888', fontSize: 13, marginTop: 4 },
  card: {
    width: CARD_W, height: CARD_H, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#111',
  },
  cardFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#151515' },
  cardGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 60,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardMeta: {
    position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  cardMetaText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardPlace: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3, maxWidth: CARD_W - 16,
  },
  cardPlaceText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { color: '#777', fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
})
