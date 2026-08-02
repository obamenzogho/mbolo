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
import { GalleryGrid } from './GalleryGrid'
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

  /* Aperçu + barre « Créer » passés en en-tête de la pellicule : tout défile
     ensemble, donc la grille récupère la hauteur de l'écran dès qu'on
     descend. Sous la caméra, ils reprennent leur place au-dessus. */
  const header = (
    <>
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
        selectedUris={selected ? [selected.uri] : []}
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
  createBar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: createColors.hairline,
  },
  /* Chaque bouton occupe un tiers de la largeur ; l'icône et son libellé
     sont centrés sur la même largeur, donc le texte tombe pile sous l'icône. */
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
  /* textAlign + width 100% : le libellé reste centré sur la largeur du
     bouton même s'il est plus court/long que l'icône. */
  createTypeLabel: {
    width: '100%',
    textAlign: 'center',
    color: createColors.textPrimary,
  },
})

export const SelectScreen = memo(SelectScreenComponent)
