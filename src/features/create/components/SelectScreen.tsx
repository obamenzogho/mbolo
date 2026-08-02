/* src/features/create/components/SelectScreen.tsx

   Étape 1 du nouveau flux, portée du prototype createPost-instagram :
   fond noir, aperçu carré du média retenu en haut, barre « Créer » (Texte /
   Caméra), puis la pellicule. Le pari d'Instagram : la publication existe
   déjà dans le téléphone, on la demande avant tout le reste. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import type { GalleryAsset } from '@/hooks/useGallery'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import { GalleryGrid } from '@/features/news/components/compose/GalleryGrid'
import { ComposeCamera } from '@/features/news/components/compose/ComposeCamera'
import { createColors, createType } from '../theme/createTokens'

interface SelectScreenProps {
  selected: SelectedMedia | null
  mode: 'gallery' | 'camera'
  onModeChange: (mode: 'gallery' | 'camera') => void
  onToggle: (asset: GalleryAsset) => void
  onCapture: (media: SelectedMedia) => void
  onPickText: () => void
}

function SelectScreenComponent({
  selected,
  mode,
  onModeChange,
  onToggle,
  onCapture,
  onPickText,
}: SelectScreenProps) {
  const { t } = useI18n()

  return (
    <View style={styles.screen}>
      {/* Aperçu carré du média retenu (ou invite). */}
      <View style={styles.previewWrap}>
        <View style={styles.preview}>
          {selected ? (
            <Image
              source={{ uri: selected.thumbnailUri ?? selected.uri }}
              style={styles.previewMedia}
              contentFit="cover"
            />
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

      {/* La pellicule, ou la caméra. */}
      {mode === 'gallery' ? (
        <GalleryGrid selectedUris={selected ? [selected.uri] : []} onToggle={onToggle} onPickMboloVideo={() => {}} />
      ) : (
        <ComposeCamera onCapture={onCapture} />
      )}
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
  createBar: {
    flexDirection: 'row',
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: createColors.hairline,
  },
  createType: { alignItems: 'center', gap: 6 },
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
  createTypeLabel: { color: createColors.textPrimary },
})

export const SelectScreen = memo(SelectScreenComponent)
