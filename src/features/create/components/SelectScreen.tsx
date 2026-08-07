/* src/features/create/components/SelectScreen.tsx

   Étape 1 du nouveau flux de création unifié (post / vidéo).

   Layout Instagram :
   - Header compact : nom de l'album (dropdown) + icônes caméra/texte + toggle multi-sélection
   - Grille pleine écran 3 colonnes (GalleryGrid)
   - Mode single (défaut) : tap = sélection immédiate → edit
   - Mode multi : tap = toggle sélection avec badges numérotés */

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { Image } from 'expo-image'
import { Video, ResizeMode } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import * as MediaLibrary from 'expo-media-library'
import type { MediaTypeValue } from 'expo-media-library'
import type { GalleryAsset } from '@/hooks/useGallery'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import { GalleryGrid } from './GalleryGrid'
import { ComposeCamera } from '@/features/news/components/compose/ComposeCamera'
import { cameraColors, createColors, createMotion } from '../theme/createTokens'
import { captureException } from '@/lib/sentry'

interface SelectScreenProps {
  media: SelectedMedia[]
  mode: 'gallery' | 'camera'
  onModeChange: (mode: 'gallery' | 'camera') => void
  onSelectAsset: (asset: GalleryAsset, multiple: boolean) => void
  onCapture: (media: SelectedMedia[]) => void
  /* Poste texte seul — absent de l'onglet Reel (Instagram n'en crée pas). */
  onPickText?: () => void
  /* Bouton « Suivant » rendu en overlay dans la caméra (l'en-tête parent
     est masqué en mode caméra). */
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  /* Filtre de types sur la pellicule (onglet Reel : vidéos seules). */
  mediaTypes?: MediaTypeValue[]
  /* Mode de capture imposé par l'onglet parent : picture (photo uniquement)
     ou video (enregistrement direct). Transmis à ComposeCamera. */
  captureMode?: 'picture' | 'video'
  /* ── Reprise caméra Reel : musique choisie (remonte de ComposeCamera).
     Le sélecteur de musique reste dans le parent (app/create.tsx). */
  soundId?: string | null
  onOpenSound?: () => void
  onClearSound?: () => void
  /* Swipe horizontal sur le corps de la caméra (clone Reel) : remonté au
     parent pour basculer d'onglet. `topBarInset` en miroir. */
  onHorizontalSwipe?: (direction: 'left' | 'right') => void
}

/* Albums système sans intérêt. */
const HIDDEN_ALBUMS = new Set(['Hidden', 'Recently Deleted', 'Masqué', 'Supprimés récemment'])

/* Largeur réservée au bouton retour posé en overlay : la barre d'outils de
   la caméra se décale d'autant pour ne pas passer dessous. */
const CAMERA_TOP_BAR_INSET = 64

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
  /* Absent sur l'onglet Reel : pas de poste texte seul. */
  onText?: () => void
}) {
  const { t } = useI18n()

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
          accessibilityLabel={t.news.compose.a11yCameraOpen}
          style={({ pressed }) => [styles.headerModeBtn, pressed && styles.pressed]}
        >
          <Ionicons name="camera-outline" size={22} color={createColors.textPrimary} />
        </Pressable>
        {onText ? (
          <Pressable
            onPress={onText}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yTextPost}
            style={({ pressed }) => [styles.headerModeBtn, pressed && styles.pressed]}
          >
            <Ionicons name="text" size={22} color={createColors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      {/* Droite : toggle multi-sélection */}
      <Pressable
        onPress={onToggleMode}
        accessibilityRole="button"
        accessibilityState={{ selected: selectionMode === 'multi' }}
        accessibilityLabel={t.news.compose.a11yMultipleSelection}
        style={({ pressed }) => [styles.headerMultiBtn, pressed && styles.pressed]}
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
  mediaTypes,
  captureMode,
  soundId,
  onOpenSound,
  onClearSound,
  onHorizontalSwipe,
}: SelectScreenProps) {
  const { t } = useI18n()
  const { width: windowWidth } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single')
  const [albums, setAlbums] = useState<AlbumOption[]>([])
  const [albumId, setAlbumId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  /* Médias capturés par la caméra : affiche un aperçu plein écran avant
     d'aller à l'éditeur. Un tableau, car une rafale produit plusieurs
     clichés d'un coup. */
  const [capturedMedia, setCapturedMedia] = useState<SelectedMedia[]>([])
  /* Cliché affiché dans l'aperçu de rafale. */
  const [previewIndex, setPreviewIndex] = useState(0)

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
    setCapturedMedia([captured])
    setPreviewIndex(0)
  }, [])

  const handleConfirmCapture = useCallback(() => {
    if (capturedMedia.length === 0) return
    onCapture(capturedMedia)
    setCapturedMedia([])
    setPreviewIndex(0)
  }, [capturedMedia, onCapture])

  const handleDiscardCapture = useCallback(() => {
    setCapturedMedia([])
    setPreviewIndex(0)
  }, [])

  const handlePreviewScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(event.nativeEvent.contentOffset.x / windowWidth)
      setPreviewIndex(page)
    },
    [windowWidth],
  )

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
       avec boutons retour et « Suivant ». Une rafale se feuillette. */
    if (capturedMedia.length > 0) {
      return (
        <View style={styles.screen}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePreviewScroll}
            style={StyleSheet.absoluteFill}
          >
            {capturedMedia.map((captured) => (
              <View key={captured.uri} style={{ width: windowWidth }}>
                {captured.type === 'video' ? (
                  <Video
                    source={{ uri: captured.uri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    useNativeControls={false}
                  />
                ) : (
                  <Image
                    source={{ uri: captured.uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                )}
              </View>
            ))}
          </ScrollView>

          {/* Bouton retour (annuler la capture) */}
          <Pressable
            onPress={handleDiscardCapture}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.a11yRetakeCapture}
style={({ pressed }) => [
              styles.cameraBackBtn,
              { top: insets.top + 50 },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="close" size={28} color={cameraColors.onMedia} />
          </Pressable>

          {/* Compteur de rafale : inutile pour un cliché unique. */}
          {capturedMedia.length > 1 ? (
            <View style={styles.previewCounter}>
              <Text style={styles.previewCounterText}>
                {`${previewIndex + 1}/${capturedMedia.length}`}
              </Text>
            </View>
          ) : null}

          {/* Bouton « Suivant » (confirmer → éditeur) */}
          <Pressable
            onPress={handleConfirmCapture}
            accessibilityRole="button"
            accessibilityLabel={nextLabel}
            style={({ pressed }) => [styles.cameraNextBtn, pressed && styles.pressed]}
          >
            <Text style={styles.cameraNextText}>{nextLabel}</Text>
          </Pressable>
        </View>
      )
    }

    return (
      <View style={styles.screen}>
        <ComposeCamera
          key={captureMode}
          onCapture={handleCameraCapture}
          initialMode={captureMode}
          topBarInset={CAMERA_TOP_BAR_INSET}
          topContentOffset={42}
          onOpenGallery={() => onModeChange('gallery')}
          soundId={soundId}
          onOpenSound={onOpenSound}
          onClearSound={onClearSound}
          onHorizontalSwipe={onHorizontalSwipe}
        />
        <Pressable
          onPress={() => onModeChange('gallery')}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.a11yGalleryBack}
          style={({ pressed }) => [
              styles.cameraBackBtn,
              { top: insets.top + 50 },
              pressed && styles.pressed,
            ]}
        >
          <Ionicons name="arrow-back" size={24} color={cameraColors.onMedia} />
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
        mediaTypes={mediaTypes}
      />
    </View>
  )
}

export const SelectScreen = memo(SelectScreenComponent)

/* ── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: createColors.canvas },
  pressed: { opacity: createMotion.pressedOpacity },

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
    backgroundColor: cameraColors.overlayScrim,
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
  cameraNextText: {
    color: cameraColors.onMedia,
    fontSize: 15,
    fontWeight: '600',
  },

  /* Compteur de rafale, centré sous les boutons du haut */
  previewCounter: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cameraColors.overlayScrim,
  },
  previewCounterText: {
    color: cameraColors.onMedia,
    fontSize: 13,
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
