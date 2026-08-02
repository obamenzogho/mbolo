/* src/features/news/components/compose/GalleryGrid.tsx

   Pellicule de l'appareil, en grille de contact.

   C'est la première chose que voit l'utilisateur : l'écran s'ouvre ici.
   Le pari d'Instagram est que dans la grande majorité des cas, la
   publication existe déjà dans le téléphone — la demander avant de
   demander quoi que ce soit d'autre supprime une étape à chaque fois.

   La sélection n'est pas tenue par `useGallery` mais par l'état du
   composeur : c'est lui qui porte la règle « une vidéo exclut les photos »
   et le plafond de médias. Deux sources de vérité divergeraient.

   Design — planche contact pure sur noir franc : trois colonnes, aucune
   bordure, les photos règnent. Un seul point de couleur, le vert Mbolo,
   vit ici : c'est la sélection. La pastille numérotée sur la cellule et le
   compteur de la barre flottante partagent cette couleur — le geste et son
   décompte sont un seul langage. La barre n'existe que tant qu'on
   sélectionne : avant, l'écran est muet, entièrement à la pellicule.

   Rendu des vignettes : `expo-image` ne sait pas charger les `ph://` d'iOS
   (échec silencieux, sans onError). On passe par l'URI locale `file://`
   que `getAssetInfoAsync` résout, rendue par le `Image` de React Native. */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import BottomSheet from '@/components/ui/BottomSheet'
import OrbitLoader from '@/components/OrbitLoader'
import { useGallery, type GalleryAsset } from '@/hooks/useGallery'
import { useI18n } from '@/i18n'
import {
  GALLERY_COLUMNS,
  GALLERY_GAP,
  HIT_SLOP,
  postColors,
  postMotion,
  postRadius,
  postSpacing,
  postType,
} from '../../theme/postTokens'

type MediaFilter = 'all' | 'photo' | 'video'

function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface GalleryGridProps {
  /** URI des médias déjà retenus : porte le numéro d'ordre de la pastille. */
  selectedUris: string[]
  onToggle: (asset: GalleryAsset) => void
  /** Ouvre le choix d'une vidéo Mbolo déjà publiée. */
  onPickMboloVideo: () => void
}

function GridCell({
  item,
  rank,
  selected,
  onToggle,
  resolveLocalUri,
}: {
  item: GalleryAsset
  rank: number
  selected: boolean
  onToggle: (asset: GalleryAsset) => void
  resolveLocalUri: (assetId: string) => Promise<string | null>
}) {
  const [localUri, setLocalUri] = useState<string | null>(null)
  const pop = useRef(new Animated.Value(0.6)).current

  /* Pas de fallback sur l'URI ph:// : le `Image` de React Native ne sait
     pas la charger (« No suitable URL request handler »). On n'affiche la
     vignette qu'une fois l'URI locale file:// résolue. */
  useEffect(() => {
    let active = true
    resolveLocalUri(item.id).then((uri) => {
      if (!active || !uri) return
      setLocalUri(uri)
    })
    return () => {
      active = false
    }
  }, [resolveLocalUri, item.id])

  /* La pastille « pop » au ressort quand la sélection la fait naître. */
  useEffect(() => {
    if (selected) {
      Animated.spring(pop, { toValue: 1, ...postMotion.spring }).start()
    }
  }, [selected, pop])

  return (
    <Pressable
      onPress={() => onToggle(item)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={item.filename}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      {localUri ? (
        <Image source={{ uri: localUri }} style={styles.thumb} resizeMode="cover" />
      ) : null}

      {item.mediaType === 'video' && item.duration ? (
        <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
      ) : null}

      {selected ? <View style={styles.selectedOverlay} /> : null}

      {selected ? (
        <Animated.View style={[styles.badge, { transform: [{ scale: pop }] }]}>
          <Text style={styles.badgeText}>{rank + 1}</Text>
        </Animated.View>
      ) : null}
    </Pressable>
  )
}

const GridCellMemo = memo(GridCell)

function GalleryGridBase({ selectedUris, onToggle, onPickMboloVideo }: GalleryGridProps) {
  const { t } = useI18n()
  const {
    permission,
    requestPermission,
    albums,
    assets,
    loading,
    error,
    loadAssets,
    loadAlbums,
    getAssetInfo,
  } = useGallery()

  const [filter, setFilter] = useState<MediaFilter>('all')
  const [album, setAlbum] = useState<{ id: string; title: string } | null>(null)
  const [albumsOpen, setAlbumsOpen] = useState(false)

  const granted = permission?.status === 'granted'
  const count = selectedUris.length

  /* Cache des URI locales résolues : la FlatList recycle les cellules,
     sans lui on referait getAssetInfoAsync à chaque retour en vue. */
  const localUrisRef = useRef<Map<string, string>>(new Map())

  const resolveLocalUri = useCallback(
    async (assetId: string): Promise<string | null> => {
      const cached = localUrisRef.current.get(assetId)
      if (cached) return cached
      const info = await getAssetInfo(assetId)
      if (!info?.localUri) return null
      localUrisRef.current.set(assetId, info.localUri)
      return info.localUri
    },
    [getAssetInfo],
  )

  /* La barre flottante n'existe que pendant une sélection : elle monte à la
     première pastille, redescend quand tout est retiré. */
  const barAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (count > 0) {
      Animated.spring(barAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 120,
      }).start()
    } else {
      Animated.timing(barAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start()
    }
  }, [count, barAnim])

  /* `loadAssets` ne demande jamais la permission de lui-même : sans cet
     appel, la grille resterait vide en silence au premier lancement. */
  useEffect(() => {
    if (permission && !granted && permission.canAskAgain) {
      requestPermission()
    }
  }, [permission, granted, requestPermission])

  useEffect(() => {
    if (granted) loadAlbums()
  }, [granted, loadAlbums])

  useEffect(() => {
    if (granted) loadAssets(filter, true, album?.id)
  }, [granted, filter, album, loadAssets])

  const handleEndReached = useCallback(() => {
    loadAssets(filter, false, album?.id)
  }, [loadAssets, filter, album])

  const renderItem = useCallback(
    ({ item }: { item: GalleryAsset }) => {
      const rank = selectedUris.indexOf(item.uri)
      return (
        <GridCellMemo
          item={item}
          rank={rank}
          selected={rank >= 0}
          onToggle={onToggle}
          resolveLocalUri={resolveLocalUri}
        />
      )
    },
    [selectedUris, onToggle, resolveLocalUri],
  )

  if (permission && !granted) {
    /* Une permission refusée sans possibilité de redemander ne se débloque
       qu'aux réglages : relancer la demande n'afficherait rien. */
    const denied = !permission.canAskAgain
    const openSettings = () => {
      Linking.openSettings()
    }
    return (
      <View style={styles.gate}>
        <Ionicons name="images-outline" size={52} color={postColors.textTertiary} />
        <Text style={styles.gateText}>
          {denied ? t.news.compose.galleryPermissionDenied : t.news.compose.galleryPermission}
        </Text>
        <Pressable
          onPress={denied ? openSettings : requestPermission}
          accessibilityRole="button"
          style={({ pressed }) => [styles.gateButton, pressed && styles.pressed]}
        >
          <Text style={styles.gateButtonText}>
            {denied ? t.news.compose.gallerySettings : t.news.compose.galleryAllow}
          </Text>
        </Pressable>
      </View>
    )
  }

  /* Un échec de chargement ne doit pas passer pour un dossier vide : on
     affiche l'erreur et une sortie de secours, sinon l'utilisateur croit
     qu'il n'a aucune photo. */
  if (error && assets.length === 0 && !loading) {
    return (
      <View style={styles.gate}>
        <Ionicons name="alert-circle-outline" size={52} color={postColors.textTertiary} />
        <Text style={styles.gateText}>{t.news.compose.galleryError}</Text>
        <Pressable
          onPress={() => loadAssets(filter, true, album?.id)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.gateButton, pressed && styles.pressed]}
        >
          <Text style={styles.gateButtonText}>{t.news.compose.galleryRetry}</Text>
        </Pressable>
      </View>
    )
  }

  const filters: { id: MediaFilter; label: string }[] = [
    { id: 'all', label: t.news.compose.galleryAll },
    { id: 'photo', label: t.news.compose.galleryPhotos },
    { id: 'video', label: t.news.compose.galleryVideos },
  ]

  const countLabel =
    count === 1
      ? t.news.compose.selectionCount.replace('{n}', '1')
      : t.news.compose.selectionCountPlural.replace('{n}', String(count))

  const barTranslate = barAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setAlbumsOpen(true)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.galleryAlbums}
          style={({ pressed }) => [styles.albumButton, pressed && styles.pressed]}
        >
          <Text style={styles.albumText} numberOfLines={1}>
            {album?.title ?? t.news.compose.galleryRecent}
          </Text>
          <Ionicons name="chevron-down" size={15} color={postColors.textPrimary} />
        </Pressable>

        <View style={styles.filters}>
          {filters.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item.id }}
              style={({ pressed }) => [
                styles.filter,
                filter === item.id && styles.filterOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.filterText, filter === item.id && styles.filterTextOn]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={GALLERY_COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : <Text style={styles.empty}>{t.news.compose.galleryEmpty}</Text>
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.footer}>
              <OrbitLoader size={28} />
            </View>
          ) : null
        }
      />

      {/* Barre flottante de sélection : un pur compteur. Le fil vert fait le
          lien entre la pastille des cellules et ce chip ; l'action « Suivant »
          vit dans l'en-tête, pas ici — un seul geste, un seul endroit. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.selectionBar,
          { opacity: barAnim, transform: [{ translateY: barTranslate }] },
        ]}
      >
        <View style={styles.countChip}>
          <Text style={styles.countText}>{count}</Text>
        </View>
        <Text style={styles.countLabel}>{countLabel}</Text>
      </Animated.View>

      <BottomSheet visible={albumsOpen} onClose={() => setAlbumsOpen(false)} height="auto">
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{t.news.compose.galleryAlbums}</Text>

          {/* Repartager une vidéo déjà publiée sur Mbolo est le même geste
              que choisir une vidéo du téléphone : même endroit. */}
          <Pressable
            onPress={() => {
              setAlbumsOpen(false)
              onPickMboloVideo()
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.albumRow, pressed && styles.pressed]}
          >
            <Ionicons name="play-circle" size={20} color={postColors.optionVideo} />
            <Text style={styles.albumRowText}>{t.news.compose.galleryMboloVideos}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setAlbum(null)
              setAlbumsOpen(false)
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.albumRow, pressed && styles.pressed]}
          >
            <Ionicons name="time-outline" size={20} color={postColors.textSecondary} />
            <Text style={styles.albumRowText}>{t.news.compose.galleryRecent}</Text>
          </Pressable>

          {albums.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setAlbum({ id: item.id, title: item.title })
                setAlbumsOpen(false)
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.albumRow, pressed && styles.pressed]}
            >
              <Ionicons name="folder-outline" size={20} color={postColors.textSecondary} />
              <Text style={styles.albumRowText} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.albumCount}>{item.assetCount}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: postColors.cameraBackdrop },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: postSpacing.gutter,
    paddingVertical: postSpacing.rowGap,
  },
  albumButton: { flexDirection: 'row', alignItems: 'center', gap: postSpacing.inlineGap },
  albumText: { maxWidth: 140, color: postColors.textPrimary, ...postType.composeTab },
  filters: { flexDirection: 'row', gap: postSpacing.inlineGap },
  filter: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: postRadius.chip,
    backgroundColor: postColors.chipSurface,
  },
  filterOn: { backgroundColor: postColors.textPrimary },
  filterText: { color: postColors.textSecondary, ...postType.composeTab },
  filterTextOn: { color: postColors.canvas },

  grid: { paddingBottom: 88 },
  row: { gap: GALLERY_GAP, marginBottom: GALLERY_GAP },
  cell: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: postColors.galleryCell,
    overflow: 'hidden',
  },
  thumb: { ...StyleSheet.absoluteFillObject },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    /* Le voile vert, pas le gris système : la sélection est la marque. */
    backgroundColor: postColors.accentSoft,
  },
  duration: {
    position: 'absolute',
    right: 5,
    bottom: 4,
    color: postColors.onMedia,
    ...postType.mediaDuration,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.selectionBadge,
    borderWidth: 1.5,
    borderColor: postColors.onMedia,
  },
  badgeText: { color: postColors.onMedia, ...postType.mediaDuration },

  /* Barre flottante : une pilule, pas une barre plein-largeur. Elle
     respire au-dessus de la planche contact et du bord de l'écran. */
  selectionBar: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: postSpacing.rowGap + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 18,
    borderRadius: postRadius.overlay,
    backgroundColor: postColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: postColors.hairline,
  },
  countChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.selectionBadge,
  },
  countText: { color: postColors.onMedia, ...postType.link },
  countLabel: {
    marginLeft: postSpacing.gutter,
    color: postColors.textPrimary,
    ...postType.link,
  },

  empty: {
    paddingTop: 60,
    textAlign: 'center',
    color: postColors.textTertiary,
    ...postType.body,
  },
  footer: { paddingVertical: postSpacing.gutter, alignItems: 'center' },

  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: postSpacing.gutter,
    paddingHorizontal: 40,
    backgroundColor: postColors.cameraBackdrop,
  },
  gateText: { textAlign: 'center', color: postColors.textSecondary, ...postType.body },
  gateButton: {
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: postRadius.chip,
    backgroundColor: postColors.accent,
  },
  gateButtonText: { color: postColors.onMedia, ...postType.link },

  sheet: { paddingHorizontal: postSpacing.gutter, paddingBottom: 28 },
  sheetTitle: {
    color: postColors.textPrimary,
    ...postType.composeSection,
    paddingVertical: postSpacing.rowGap,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.gutter,
    paddingVertical: 12,
  },
  albumRowText: { flex: 1, color: postColors.textPrimary, ...postType.composeOption },
  albumCount: { color: postColors.textTertiary, ...postType.meta },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const GalleryGrid = memo(GalleryGridBase)
