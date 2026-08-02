/* src/features/create/components/AlbumPicker.tsx

   Sélecteur d'album de la pellicule : un bouton portant le nom de l'album
   courant, et une liste déroulante posée par-dessus la grille.

   Composant purement présentationnel — le chargement des albums et l'état de
   la sélection vivent dans `GalleryGrid`. Découpé à part parce que
   `GalleryGrid` porte déjà tout le cycle de vie de la pellicule.

   La liste est une `View` absolue, pas un `Modal` : elle reste dans l'arbre
   de la grille, donc ni portail ni conflit de superposition avec la barre
   d'onglets. */

import { memo } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { createColors } from '../theme/createTokens'

export interface AlbumOption {
  /* `null` = toute la pellicule, sans filtre d'album. */
  id: string | null
  title: string
  assetCount: number
}

interface AlbumPickerProps {
  albums: AlbumOption[]
  currentId: string | null
  open: boolean
  onToggleOpen: () => void
  onSelect: (id: string | null) => void
}

export const AlbumPickerButton = memo(function AlbumPickerButton({
  albums,
  currentId,
  open,
  onToggleOpen,
}: Pick<AlbumPickerProps, 'albums' | 'currentId' | 'open' | 'onToggleOpen'>) {
  const { t } = useI18n()

  /* Aucun album chargé (échec de l'API, ou pellicule sans dossier) : pas de
     bouton, la grille montre toujours toutes les photos. */
  if (albums.length <= 1) return null

  const current = albums.find((a) => a.id === currentId)
  const label = current?.title ?? t.news.compose.galleryAlbumAll

  return (
    <View style={styles.triggerRow}>
      <Pressable
        onPress={onToggleOpen}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t.news.compose.galleryAlbums}
        style={styles.trigger}
      >
        <Text numberOfLines={1} style={styles.triggerText}>
          {label}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={createColors.textPrimary}
        />
      </Pressable>
    </View>
  )
})

export const AlbumPickerList = memo(function AlbumPickerList({
  albums,
  currentId,
  onSelect,
}: Pick<AlbumPickerProps, 'albums' | 'currentId' | 'onSelect'>) {
  const { t } = useI18n()

  return (
    <View style={styles.sheet}>
      <Text style={styles.sheetTitle}>{t.news.compose.galleryAlbums}</Text>
      <FlatList
        data={albums}
        keyExtractor={(item) => item.id ?? '__all__'}
        renderItem={({ item }) => (
          <AlbumRow
            album={item}
            selected={item.id === currentId}
            onSelect={onSelect}
          />
        )}
      />
    </View>
  )
})

const AlbumRow = memo(function AlbumRow({
  album,
  selected,
  onSelect,
}: {
  album: AlbumOption
  selected: boolean
  onSelect: (id: string | null) => void
}) {
  return (
    <Pressable
      onPress={() => onSelect(album.id)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={styles.row}
    >
      <Text numberOfLines={1} style={styles.rowTitle}>
        {album.title}
      </Text>
      <Text style={styles.rowCount}>{album.assetCount}</Text>
      {selected ? (
        <Ionicons name="checkmark" size={18} color={createColors.accent} />
      ) : null}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  triggerRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  trigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: createColors.surfaceDim,
  },
  triggerText: {
    flexShrink: 1,
    color: createColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: createColors.canvas,
  },
  sheetTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    color: createColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: createColors.hairline,
  },
  rowTitle: {
    flex: 1,
    color: createColors.textPrimary,
    fontSize: 15,
  },
  rowCount: {
    color: createColors.textTertiary,
    fontSize: 13,
  },
})
