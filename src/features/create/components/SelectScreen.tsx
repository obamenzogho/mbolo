/* src/features/create/components/SelectScreen.tsx

   Étape 1 du nouveau flux, portée du prototype createPost-instagram :
   fond noir, aperçu carré du média retenu en haut, barre « Créer » (Texte /
   Caméra), puis la pellicule. Le pari d'Instagram : la publication existe
   déjà dans le téléphone, on la demande avant tout le reste.

   Sélection multiple jusqu'à 4 médias, carrousel horizontal sous l'aperçu,
   OrbitLoader pendant le chargement de l'image. */

import { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import type { GalleryAsset } from '@/hooks/useGallery'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import { GalleryGrid } from './GalleryGrid'
import { ComposeCamera } from '@/features/news/components/compose/ComposeCamera'
import { createColors, createType } from '../theme/createTokens'
import OrbitLoader from '@/components/OrbitLoader'

const MAX_MEDIA = 4
const THUMB_SIZE = 56
const THUMB_GAP = 4

interface SelectScreenProps {
  media: SelectedMedia[]
  mode: 'gallery' | 'camera'
  onModeChange: (mode: 'gallery' | 'camera') => void
  onToggle: (asset: GalleryAsset) => void
  onCapture: (media: SelectedMedia) => void
  onPickText: () => void
}

function SelectScreenComponent({
  media,
  mode,
  onModeChange,
  onToggle,
  onCapture,
  onPickText,
}: SelectScreenProps) {
  const { t } = useI18n()
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)

  const focused = media[focusedIndex] ?? null

  /* Map URI → numéro d'ordre (1, 2, 3, 4) pour les badges de la grille. */
  const selectionOrder = useMemo(() => {
    const map = new Map<string, number>()
    media.forEach((m, idx) => map.set(m.uri, idx + 1))
    return map
  }, [media])

  const handleLoadStart = useCallback(() => setPreviewLoading(true), [])
  const handleLoadEnd = useCallback(() => setPreviewLoading(false), [])

  const handleThumbPress = useCallback((idx: number) => {
    setFocusedIndex(idx)
  }, [])

  /* Aperçu + barre « Créer » + carrousel passés en en-tête de la pellicule :
     tout défile ensemble, donc la grille récupère la hauteur de l'écran dès
     qu'on descend. Sous la caméra, l'en-tête reprend sa place au-dessus. */
  const header = (
    <>
      {/* Aperçu carré du média focalisé (ou invite). */}
      <View style={styles.previewWrap}>
        <View style={styles.preview}>
          {focused ? (
            <>
              <Image
                source={{ uri: focused.thumbnailUri ?? focused.uri }}
                style={styles.previewMedia}
                contentFit="cover"
                onLoadStart={handleLoadStart}
                onLoadEnd={handleLoadEnd}
              />
              {previewLoading ? (
                <View style={styles.loaderOverlay}>
                  <OrbitLoader size={40} />
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.previewEmpty}>
              <Ionicons
                name="images-outline"
                size={48}
                color={createColors.textTertiary}
              />
              <Text style={[styles.emptyText, createType.placeholder]}>
                {t.news.compose.placeholder}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Carrousel horizontal des médias sélectionnés. */}
      {media.length > 0 ? (
        <View style={styles.carouselWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
          >
            {media.map((m, idx) => (
              <Pressable
                key={m.uri}
                onPress={() => handleThumbPress(idx)}
                accessibilityRole="button"
                accessibilityState={{ selected: idx === focusedIndex }}
                style={[
                  styles.thumb,
                  idx === focusedIndex && styles.thumbFocused,
                ]}
              >
                <Image
                  source={{ uri: m.thumbnailUri ?? m.uri }}
                  style={styles.thumbImage}
                  contentFit="cover"
                />
                {m.type === 'video' ? (
                  <View style={styles.videoBadge}>
                    <Ionicons name="play" size={10} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Barre « Créer » : Galerie / Caméra / Texte. */}
      <View style={styles.createBar}>
        <CreateTypeButton
          icon="images-outline"
          label={t.news.compose.modeGallery}
          highlighted={mode === 'gallery'}
          onPress={() => onModeChange('gallery')}
        />
        <CreateTypeButton
          icon="camera-outline"
          label={t.news.compose.modeCamera}
          highlighted={mode === 'camera'}
          onPress={() => onModeChange('camera')}
        />
        <CreateTypeButton
          icon="text"
          label={t.news.compose.modeText}
          onPress={onPickText}
        />
      </View>
    </>
  )

  if (mode === 'camera') {
    return (
      <View style={styles.screen}>
        {header}
        <ComposeCamera onCapture={onCapture} />
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <GalleryGrid
        selectedUris={media.map((m) => m.uri)}
        selectionOrder={selectionOrder}
        onToggle={onToggle}
        header={header}
      />
    </View>
  )
}

function CreateTypeButton({
  icon,
  label,
  highlighted,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  highlighted?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.createType, pressed && styles.createTypePressed]}
    >
      <View style={[styles.createTypeCircle, highlighted && styles.createTypeCircleActive]}>
        <Ionicons name={icon} size={22} color={createColors.textPrimary} />
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.createTypeLabel,
          createType.createLabel,
          !highlighted && { color: createColors.textTertiary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: createColors.canvas },
  previewWrap: {
    alignItems: 'center',
    padding: 12,
  },
  preview: {
    aspectRatio: 1,
    width: '100%',
    maxWidth: 330,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: createColors.surface,
  },
  previewMedia: { width: '100%', height: '100%' },
  previewEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: { color: createColors.textTertiary },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: createColors.surface,
  },
  carouselWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  carouselContent: {
    paddingHorizontal: 12,
    gap: THUMB_GAP,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbFocused: {
    borderColor: createColors.accent,
  },
  thumbImage: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  createBar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: createColors.hairline,
  },
  createType: { flex: 1, alignItems: 'center', gap: 6 },
  createTypePressed: { opacity: 0.6 },
  createTypeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: createColors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTypeCircleActive: {
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  createTypeLabel: {
    width: '100%',
    textAlign: 'center',
    color: createColors.textPrimary,
  },
})

export const SelectScreen = memo(SelectScreenComponent)
