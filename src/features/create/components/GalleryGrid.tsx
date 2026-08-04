/* src/features/create/components/GalleryGrid.tsx

   Pellicule de l'appareil pour le nouveau flux de création, en grille de
   contact sombre (design du prototype createPost-instagram).

   Rendu des vignettes : `expo-image` charge directement les `content://`
   (Android) et `ph://` (iOS) retournés par `MediaLibrary` — pas de
   `getAssetInfoAsync` par cellule, donc aucun surcoût ni surchauffe.

   La sélection est portée par le flux (`selectedUris`), pas par ce
   composant : l'écran garde la règle « une photo ou une vidéo ». */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import * as MediaLibrary from 'expo-media-library'
import { useI18n } from '@/i18n'
import { captureException } from '@/lib/sentry'
import type { GalleryAsset } from '@/hooks/useGallery'
import { createColors } from '../theme/createTokens'
import { AlbumPickerButton, AlbumPickerList, type AlbumOption } from './AlbumPicker'

interface GalleryGridProps {
  selectedUris: string[]
  onToggle: (asset: GalleryAsset) => void
  /* Mode de sélection : 'single' (défaut) → tap = sélection immédiate,
     'multi' → tap = toggle avec badges numérotés. */
  selectionMode?: 'single' | 'multi'
  /* Appelé en mode single quand l'utilisateur tape sur une cellule. */
  onSelectImmediate?: (asset: GalleryAsset) => void
  /* Index de sélection (1, 2, 3, 4) pour chaque URI. Si absent, on affiche
     un checkmark simple (rétrocompatibilité). */
  selectionOrder?: Map<string, number>
}

const COLUMNS = 3
const GAP = 2
const PAGE_SIZE = 60

/* Albums système sans intérêt ici : ils ne contiennent rien de publiable. */
const HIDDEN_ALBUMS = new Set(['Hidden', 'Recently Deleted', 'Masqué', 'Supprimés récemment'])

function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function GalleryGridComponent({
  selectedUris,
  onToggle,
  selectionMode = 'single',
  onSelectImmediate,
  selectionOrder,
}: GalleryGridProps) {
  const { t } = useI18n()
  const { width } = useWindowDimensions()
  const [permission, requestPermission] = MediaLibrary.usePermissions()
  const [assets, setAssets] = useState<GalleryAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawAlbums, setRawAlbums] = useState<MediaLibrary.Album[]>([])
  const [albumId, setAlbumId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const cursorRef = useRef<string | null>(null)
  const loadingRef = useRef(false)
  const hasMoreRef = useRef(true)
  const requestRef = useRef(0)

  const granted = permission?.status === 'granted'
  const askedRef = useRef(false)

  /* Une seule demande par montage : l'objet `permission` change d'identité à
     chaque rendu, sans ce garde la demande repartirait en boucle. */
  useEffect(() => {
    if (askedRef.current) return
    if (permission && !granted && permission.canAskAgain) {
      askedRef.current = true
      requestPermission()
    }
  }, [permission, granted, requestPermission])

  const loadAssets = useCallback(
    async (reset = false) => {
      if (!granted) return
      /* Une remise à zéro passe outre un chargement en cours : sans ça, un
         changement d'album pendant une page laisserait la grille sur
         l'album précédent. Le jeton rend l'ancienne requête sans effet. */
      if (!reset && loadingRef.current) return
      if (!reset && !hasMoreRef.current) return

      const token = reset ? ++requestRef.current : requestRef.current
      loadingRef.current = true
      setLoading(true)
      try {
        const options: MediaLibrary.AssetsOptions = {
          first: PAGE_SIZE,
          sortBy: [MediaLibrary.SortBy.creationTime],
          mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        }
        if (albumId) {
          options.album = albumId
        }
        /* `after` non renseigné : on ne le passe PAS — `after: undefined`
           explicite peut faire échouer la requête nativement. */
        if (!reset && cursorRef.current) {
          options.after = cursorRef.current
        }

        const result = await MediaLibrary.getAssetsAsync(options)
        if (token !== requestRef.current) return

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
        setError(null)
      } catch (e) {
        if (token !== requestRef.current) return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        /* Une requête périmée ne relâche pas le verrou : celle qui l'a
           remplacée est encore en vol et en est propriétaire. */
        if (token === requestRef.current) {
          loadingRef.current = false
          setLoading(false)
        }
      }
    },
    [granted, albumId],
  )

  /* Chargement initial une seule fois : `usePermissions` renvoie un objet
     neuf à chaque rendu, donc dépendre de lui rechargerait la pellicule en
     boucle. Le booléen `granted` ne change qu'à l'octroi réel. */
  useEffect(() => {
    if (granted) loadAssets(true)
  }, [granted, loadAssets])

  /* Les albums ne changent pas en cours de session : un seul chargement.
     Un échec ne remonte pas d'erreur — la pellicule complète reste lisible,
     seul le sélecteur disparaît. */
  useEffect(() => {
    if (!granted) return
    let alive = true
    MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
      .then((found) => {
        if (alive) setRawAlbums(found)
      })
      .catch((error) => {
        captureException(error instanceof Error ? error : new Error(String(error)), {
          context: 'create.galleryAlbums',
        })
      })
    return () => {
      alive = false
    }
  }, [granted])

  /* Dépendance sur la chaîne, pas sur `t` : `getTranslation` renvoie un objet
     neuf à chaque rendu, la mémoïsation serait sans effet. */
  const allLabel = t.news.compose.galleryAlbumAll
  const albums = useMemo<AlbumOption[]>(
    () => [
      { id: null, title: allLabel, assetCount: 0 },
      ...rawAlbums
        .filter((a) => a.assetCount > 0 && !HIDDEN_ALBUMS.has(a.title))
        .map((a) => ({ id: a.id, title: a.title, assetCount: a.assetCount })),
    ],
    [rawAlbums, allLabel],
  )

  /* Changer d'album repart de zéro : le curseur de l'album précédent n'a
     aucun sens dans le nouveau. On vide aussi la grille — laisser les photos
     de l'ancien album sous le nom du nouveau serait un mensonge le temps du
     chargement. Le rechargement vient de l'effet ci-dessus, `loadAssets`
     changeant d'identité avec `albumId`. */
  const handleSelectAlbum = useCallback(
    (id: string | null) => {
      setPickerOpen(false)
      if (id === albumId) return
      cursorRef.current = null
      hasMoreRef.current = true
      setAssets([])
      setAlbumId(id)
    },
    [albumId],
  )

  const handleTogglePicker = useCallback(() => setPickerOpen((v) => !v), [])

  const handleEndReached = useCallback(() => {
    loadAssets(false)
  }, [loadAssets])

  /* Taille de cellule explicite : `flex: 1/COLUMNS` + `aspectRatio` donne
     une cellule 0x0 (flexBasis nul, Yoga dérive la hauteur avant de
     résoudre la croissance), donc grille invisible. */
  const cellSize = Math.floor((width - GAP * (COLUMNS + 1)) / COLUMNS)

  const renderItem = useCallback(
    ({ item }: { item: GalleryAsset }) => (
      <GridCell
        item={item}
        size={cellSize}
        selected={selectedUris.includes(item.uri)}
        selectionIndex={selectionOrder?.get(item.uri)}
        selectionMode={selectionMode}
        onToggle={onToggle}
        onSelectImmediate={onSelectImmediate}
      />
    ),
    [selectedUris, selectionOrder, onToggle, cellSize, selectionMode, onSelectImmediate],
  )

  /* Permission non donnée : porte d'entrée vers la demande ou les réglages.
     L'en-tête est conservé — l'aperçu vient de `SelectScreen` et n'a pas à
     s'évanouir parce que la pellicule est inaccessible. */
  if (permission && !granted) {
    const denied = !permission.canAskAgain
    const openSettings = () => Linking.openSettings()
    return (
      <View style={styles.root}>
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
      </View>
    )
  }

  /* Un échec de chargement ne doit pas passer pour un dossier vide. */
  if (error && assets.length === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.gate}>
          <Ionicons name="alert-circle-outline" size={52} color={createColors.textTertiary} />
          <Text style={styles.gateText}>{t.news.compose.galleryError}</Text>
          <Text style={styles.gateDetail}>{error}</Text>
          <Pressable
            onPress={() => loadAssets(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.gateButton, pressed && styles.gateButtonPressed]}
          >
            <Text style={styles.gateButtonText}>{t.news.compose.galleryRetry}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AlbumPickerButton
        albums={albums}
        currentId={albumId}
        open={pickerOpen}
        onToggleOpen={handleTogglePicker}
      />
      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        initialNumToRender={12}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t.news.compose.galleryEmpty}</Text>
            </View>
          )
        }
      />

      {pickerOpen ? (
        <AlbumPickerList albums={albums} currentId={albumId} onSelect={handleSelectAlbum} />
      ) : null}
    </View>
  )
}

const GridCell = memo(function GridCell({
  item,
  size,
  selected,
  selectionIndex,
  selectionMode,
  onToggle,
  onSelectImmediate,
}: {
  item: GalleryAsset
  size: number
  selected: boolean
  selectionIndex?: number
  selectionMode: 'single' | 'multi'
  onToggle: (asset: GalleryAsset) => void
  onSelectImmediate?: (asset: GalleryAsset) => void
}) {
  const handlePress = useCallback(() => {
    if (selectionMode === 'single' && onSelectImmediate) {
      onSelectImmediate(item)
    } else {
      onToggle(item)
    }
  }, [selectionMode, item, onToggle, onSelectImmediate])

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={item.filename}
      /* Style en tableau, jamais en fonction : NativeWind enveloppe les
         composants RN (`jsxImportSource`) et n'appelle pas `style` sous sa
         forme `({ pressed }) => …`, ce qui laisse la cellule sans largeur. */
      style={[styles.cell, { width: size, height: size }]}
    >
      <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" transition={100} />

      {item.mediaType === 'video' && item.duration ? (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
      ) : null}

      {selectionMode === 'multi' && selected ? <View style={styles.selectedOverlay} /> : null}
      {selectionMode === 'multi' && selected ? (
        <View style={styles.badge}>
          {selectionIndex !== undefined ? (
            <Text style={styles.badgeNumber}>{selectionIndex}</Text>
          ) : (
            <Ionicons name="checkmark" size={14} color="#fff" />
          )}
        </View>
      ) : null}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: createColors.canvas },
  content: { paddingHorizontal: GAP, paddingBottom: GAP },
  row: { gap: GAP, marginBottom: GAP },
  cell: {
    borderRadius: 2,
    overflow: 'hidden',
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
  badgeNumber: { color: '#fff', fontSize: 11, fontWeight: '700' },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
    backgroundColor: createColors.canvas,
  },
  gateText: { color: createColors.textTertiary, textAlign: 'center', fontSize: 14 },
  gateDetail: { color: createColors.textTertiary, textAlign: 'center', fontSize: 12, opacity: 0.7 },
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
