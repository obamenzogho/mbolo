/* src/features/create/components/SelectScreen.tsx

   Étape 1 du nouveau flux de création unifié (post / vidéo).

   Layout Instagram :
   - Header compact : nom de l'album (dropdown) + icônes caméra/texte + toggle multi-sélection
   - Grille pleine écran 3 colonnes (GalleryGrid)
   - Mode single (défaut) : tap = sélection immédiate → edit
   - Mode multi : tap = toggle sélection avec badges numérotés */

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Video, ResizeMode } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import * as MediaLibrary from 'expo-media-library'
import type { GalleryAsset } from '@/hooks/useGallery'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import { GalleryGrid } from './GalleryGrid'
import { ComposeCamera } from '@/features/news/components/compose/ComposeCamera'
import { createColors, createType } from '../theme/createTokens'
import { captureException } from '@/lib/sentry'

interface SelectScreenProps {
  media: SelectedMedia[]
  mode: 'gallery' | 'camera'
  onModeChange: (mode: 'gallery' | 'camera') => void
  onSelectAsset: (asset: GalleryAsset, multiple: boolean) => void
  onCapture: (media: SelectedMedia) => void
  onPickText: () => void
  /* Bouton « Suivant » rendu en overlay dans la caméra (l'en-tête parent
     est masqué en mode caméra). */
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
}

/* Albums système sans intérêt. */
const HIDDEN_ALBUMS = new Set(['Hidden', 'Recently Deleted', 'Masqué', 'Supprimés récemment'])

/* ── Header Instagram ────────────────────────────────────────────── */

function GalleryHeader({
  albumLabel,
  pickerOpen,
  onTogglePicker,
  selectionMode,
  onToggleMode,
  onCamera,
  onText,
}: {
  albumLabel: string
  pickerOpen: boolean
  onTogglePicker: () => void
  selectionMode: 'single' | 'multi'
  onToggleMode: () => void
  onCamera: () => void
  onText: () => void
}) {
  return (
    <View style={styles.galleryHeader}>
      {/* Gauche : nom de l'album + flèche */}
      <Pressable
        onPress={onTogglePicker}
        accessibilityRole="button"
        accessibilityState={{ expanded: pickerOpen }}
        style={styles.albumTrigger}
      >
        <Text numberOfLines={1} style={styles.albumLabel}>
          {albumLabel}
        </Text>
        <Ionicons
          name={pickerOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={createColors.textPrimary}
        />
      </Pressable>

      {/* Centre : icônes modes */}
      <View style={styles.headerModes}>
        <Pressable
          onPress={onCamera}
          accessibilityRole="button"
          accessibilityLabel="Caméra"
          style={({ pressed }) => [styles.headerModeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="camera-outline" size={22} color={createColors.textPrimary} />
        </Pressable>
        <Pressable
          onPress={onText}
          accessibilityRole="button"
          accessibilityLabel="Texte"
          style={({ pressed }) => [styles.headerModeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="text" size={22} color={createColors.textPrimary} />
        </Pressable>
      </View>

      {/* Droite : toggle multi-sélection */}
      <Pressable
        onPress={onToggleMode}
        accessibilityRole="button"
        accessibilityState={{ selected: selectionMode === 'multi' }}
        accessibilityLabel="Sélection multiple"
        style={({ pressed }) => [styles.headerMultiBtn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons
          name="copy-outline"
          size={20}
          color={selectionMode === 'multi' ? createColors.textPrimary : createColors.textSecondary}
        />
      </Pressable>
    </View>
  )
}

/* ── Sélecteur d'album (dropdown en overlay) ─────────────────────── */

interface AlbumOption {
  id: string | null
  title: string
  assetCount: number
}

function AlbumDropdown({
  albums,
  currentId,
  onSelect,
}: {
  albums: AlbumOption[]
  currentId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <View style={styles.albumDropdown}>
      {albums.map((album) => (
        <Pressable
          key={album.id ?? '__all__'}
          onPress={() => onSelect(album.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: album.id === currentId }}
          style={styles.albumRow}
        >
          <Text numberOfLines={1} style={styles.albumRowTitle}>
            {album.title}
          </Text>
          {album.id === currentId ? (
            <Ionicons name="checkmark" size={18} color={createColors.accent} />
          ) : null}
        </Pressable>
      ))}
    </View>
  )
}

/* ── SelectScreen ────────────────────────────────────────────────── */

function SelectScreenComponent({
  media,
  mode,
  onModeChange,
  onSelectAsset,
  onCapture,
  onPickText,
  onNext,
  nextLabel,
  nextDisabled,
}: SelectScreenProps) {
  const { t } = useI18n()
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single')
  const [albums, setAlbums] = useState<AlbumOption[]>([])
  const [albumId, setAlbumId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  /* Média capturé par la caméra : affiche un aperçu plein écran avant
     d'aller à l'éditeur (comportement TikTok). */
  const [capturedMedia, setCapturedMedia] = useState<SelectedMedia | null>(null)

  const allLabel = t.news.compose.galleryAlbumAll
  const currentAlbum = albums.find((a) => a.id === albumId)
  const albumLabel = currentAlbum?.title ?? allLabel

  /* ── Chargement des albums ─────────────────────────────────────── */
  useEffect(() => {
    let alive = true
    MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })
      .then((found) => {
        if (!alive) return
        const mapped: AlbumOption[] = [
          { id: null, title: allLabel, assetCount: 0 },
          ...found
            .filter((a) => a.assetCount > 0 && !HIDDEN_ALBUMS.has(a.title))
            .map((a) => ({ id: a.id, title: a.title, assetCount: a.assetCount })),
        ]
        setAlbums(mapped)
      })
      .catch((error) => {
        captureException(error instanceof Error ? error : new Error(String(error)), {
          context: 'create.selectScreen.albums',
        })
      })
    return () => { alive = false }
  }, [allLabel])

  /* ── Callbacks ─────────────────────────────────────────────────── */
  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => (prev === 'single' ? 'multi' : 'single'))
  }, [])

  const handleTogglePicker = useCallback(() => setPickerOpen((v) => !v), [])

  const handleSelectAlbum = useCallback((id: string | null) => {
    setPickerOpen(false)
    setAlbumId(id)
  }, [])

  const handleSelectImmediate = useCallback((asset: GalleryAsset) => {
    onSelectAsset(asset, false)
  }, [onSelectAsset])

  const handleToggleAsset = useCallback((asset: GalleryAsset) => {
    onSelectAsset(asset, true)
  }, [onSelectAsset])

  /* ── Caméra : capture → aperçu → suivant ───────────────────────── */
  const handleCameraCapture = useCallback((captured: SelectedMedia) => {
    setCapturedMedia(captured)
  }, [])

  const handleConfirmCapture = useCallback(() => {
    if (!capturedMedia) return
    onCapture(capturedMedia)
    setCapturedMedia(null)
  }, [capturedMedia, onCapture])

  const handleDiscardCapture = useCallback(() => {
    setCapturedMedia(null)
  }, [])

  /* ── Selection order pour le mode multi ────────────────────────── */
  const selectionOrder = useMemo(() => {
    if (selectionMode !== 'multi') return undefined
    const map = new Map<string, number>()
    media.forEach((m, idx) => map.set(m.uri, idx + 1))
    return map
  }, [media, selectionMode])

  /* ── Rendu mode caméra ─────────────────────────────────────────── */
  if (mode === 'camera') {
    /* Aperçu après capture (style TikTok) : photo/vidéo plein écran
       avec boutons retour et « Suivant ». */
    if (capturedMedia) {
      return (
        <View style={styles.screen}>
          {capturedMedia.type === 'video' ? (
            <Video
              source={{ uri: capturedMedia.uri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              useNativeControls={false}
            />
          ) : (
            <Image
              source={{ uri: capturedMedia.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}
          {/* Bouton retour (annuler la capture) */}
          <Pressable
            onPress={handleDiscardCapture}
            accessibilityRole="button"
            accessibilityLabel="Reprendre la photo"
            style={({ pressed }) => [styles.cameraBackBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {/* Bouton « Suivant » (confirmer → éditeur) */}
          <Pressable
            onPress={handleConfirmCapture}
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
            style={({ pressed }) => [styles.cameraNextBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cameraNextText}>{nextLabel}</Text>
          </Pressable>
        </View>
      )
    }

    return (
      <View style={styles.screen}>
        <ComposeCamera onCapture={handleCameraCapture} topBarInset={64} />
        <Pressable
          onPress={() => onModeChange('gallery')}
          accessibilityRole="button"
          accessibilityLabel="Retour à la galerie"
          style={({ pressed }) => [styles.cameraBackBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
      </View>
    )
  }

  /* ── Rendu mode galerie ────────────────────────────────────────── */
  return (
    <View style={styles.screen}>
      <GalleryHeader
        albumLabel={albumLabel}
        pickerOpen={pickerOpen}
        onTogglePicker={handleTogglePicker}
        selectionMode={selectionMode}
        onToggleMode={toggleSelectionMode}
        onCamera={() => onModeChange('camera')}
        onText={onPickText}
      />

      {pickerOpen ? (
        <AlbumDropdown
          albums={albums}
          currentId={albumId}
          onSelect={handleSelectAlbum}
        />
      ) : null}

      <GalleryGrid
        selectedUris={media.map((m) => m.uri)}
        selectionMode={selectionMode}
        onSelectImmediate={handleSelectImmediate}
        onToggle={handleToggleAsset}
        selectionOrder={selectionOrder}
      />
    </View>
  )
}

export const SelectScreen = memo(SelectScreenComponent)

/* ── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: createColors.canvas },

  /* Header Instagram */
  galleryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: createColors.canvas,
  },
  albumTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '50%',
  },
  albumLabel: {
    color: createColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  headerModes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerModeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMultiBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Bouton retour caméra — à gauche de l'icône flash */
  cameraBackBtn: {
    position: 'absolute',
    top: 16,
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  /* Bouton « Suivant » caméra — même ligne que le bouton retour */
  cameraNextBtn: {
    position: 'absolute',
    top: 16,
    right: 12,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: createColors.accent,
  },
  cameraNextBtnDisabled: {
    opacity: 0.4,
  },
  cameraNextText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Dropdown album */
  albumDropdown: {
    backgroundColor: createColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: createColors.hairline,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: createColors.hairline,
  },
  albumRowTitle: {
    flex: 1,
    color: createColors.textPrimary,
    fontSize: 15,
  },
})
