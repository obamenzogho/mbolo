/* src/features/create/components/GalleryGrid.tsx

   Pellicule de l'appareil pour le nouveau flux de création, en grille de
   contact sombre (design du prototype createPost-instagram).

   Rendu des vignettes : `expo-image` charge directement les `content://`
   (Android) et `ph://` (iOS) retournés par `MediaLibrary` — pas de
   `getAssetInfoAsync` par cellule, donc aucun surcoût ni surchauffe.

   La sélection est portée par le flux (`selectedUris`), pas par ce
   composant : l'écran garde la règle « une photo ou une vidéo ». */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as MediaLibrary from 'expo-media-library'
import { useI18n } from '@/i18n'
import type { GalleryAsset } from '@/hooks/useGallery'
import { createColors } from '../theme/createTokens'

interface GalleryGridProps {
  selectedUris: string[]
  onToggle: (asset: GalleryAsset) => void
}

const COLUMNS = 3
const PAGE_SIZE = 60

function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function GalleryGridComponent({ selectedUris, onToggle }: GalleryGridProps) {
  const { t } = useI18n()
  const [permission, requestPermission] = MediaLibrary.usePermissions()
  const [assets, setAssets] = useState<GalleryAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const cursorRef = useRef<string | null>(null)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)

  const granted = permission?.status === 'granted'

  /* Demande la permission au premier rendu (jamais en boucle : l'effet ne
     re-déclenche que si l'objet permission change). */
  useEffect(() => {
    if (permission && !granted && permission.canAskAgain) {
      requestPermission()
    }
  }, [permission, granted, requestPermission])

  const loadAssets = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return
      if (!reset && !hasMoreRef.current) return
      if (permission?.status !== 'granted') return

      loadingRef.current = true
      try {
        const result = await MediaLibrary.getAssetsAsync({
          first: PAGE_SIZE,
          sortBy: [MediaLibrary.SortBy.creationTime],
          mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
          after: reset ? undefined : (cursorRef.current ?? undefined),
        })

        const mapped: GalleryAsset[] = result.assets.map((a) => ({
          id: a.id,
          uri: a.uri,
          filename: a.filename || `media_${a.id}`,
          mediaType: a.mediaType === 'video' ? 'video' : a.mediaType === 'photo' ? 'photo' : 'unknown',
          width: a.width || 0,
          height: a.height || 0,
          creationTime: a.creationTime || Date.now(),
          duration: a.duration,
          modificationTime: a.modificationTime || a.creationTime || Date.now(),
        }))

        setAssets((prev) => (reset ? mapped : [...prev, ...mapped]))
        cursorRef.current = result.endCursor
        hasMoreRef.current = result.hasNextPage
        setHasMore(result.hasNextPage)
      } catch {
        /* Échec de lecture : on garde la grille vide, sans boucle. */
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [permission],
  )

  useEffect(() => {
    if (granted) loadAssets(true)
  }, [granted, loadAssets])

  const handleEndReached = useCallback(() => {
    loadAssets(false)
  }, [loadAssets])

  const renderItem = useCallback(
    ({ item }: { item: GalleryAsset }) => {
      const selected = selectedUris.includes(item.uri)
      return (
        <GridCell
          item={item}
          selected={selected}
          onToggle={onToggle}
        />
      )
    },
    [selectedUris, onToggle],
  )

  /* Permission non donnée : porte d'entrée vers la demande ou les réglages. */
  if (permission && !granted) {
    const denied = !permission.canAskAgain
    const openSettings = () => Linking.openSettings()
    return (
      <View style={styles.gate}>
        <Ionicons name="images-outline" size={52} color={createColors.textTertiary} />
        <Text style={styles.gateText}>
          {denied ? t.news.compose.galleryPermissionDenied : t.news.compose.galleryPermission}
        </Text>
        <Pressable
          onPress={denied ? openSettings : requestPermission}
          accessibilityRole="button"
          style={({ pressed }) => [styles.gateButton, pressed && styles.gateButtonPressed]}
        >
          <Text style={styles.gateButtonText}>
            {denied ? t.news.compose.gallerySettings : t.news.compose.galleryAllow}
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={COLUMNS}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        initialNumToRender={12}
        windowSize={5}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t.news.compose.galleryEmpty}</Text>
            </View>
          )
        }
      />
    </View>
  )
}

const GridCell = memo(function GridCell({
  item,
  selected,
  onToggle,
}: {
  item: GalleryAsset
  selected: boolean
  onToggle: (asset: GalleryAsset) => void
}) {
  return (
    <Pressable
      onPress={() => onToggle(item)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={item.filename}
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
    >
      <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" transition={100} />

      {item.mediaType === 'video' && item.duration ? (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
      ) : null}

      {selected ? <View style={styles.selectedOverlay} /> : null}
      {selected ? (
        <View style={styles.badge}>
          <Ionicons name="checkmark" size={14} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: createColors.canvas },
  cell: {
    flex: 1 / COLUMNS,
    aspectRatio: 1,
    margin: StyleSheet.hairlineWidth,
    backgroundColor: createColors.surface,
  },
  cellPressed: { opacity: 0.7 },
  thumb: { width: '100%', height: '100%' },
  durationBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  durationText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: createColors.accent,
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
    backgroundColor: createColors.canvas,
  },
  gateText: { color: createColors.textTertiary, textAlign: 'center', fontSize: 14 },
  gateButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: createColors.surfaceDim,
  },
  gateButtonPressed: { opacity: 0.7 },
  gateButtonText: { color: createColors.textPrimary, fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 48 },
  emptyText: { color: createColors.textTertiary, fontSize: 14 },
})

export const GalleryGrid = memo(GalleryGridComponent)
