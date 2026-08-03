/* EditScreen.tsx — Écran d'édition des médias.

   Port du prototype createPost-instagram. 7 onglets : Crop, Filter,
   Edit (adjustments), Effect, Draw, Text, Sticker.

   Modifie directement les champs d'édition de SelectedMedia via
   onMediaChange. L'application réelle des filtres/ajustements se
   fait au moment de l'upload via expo-image-manipulator. */

import { memo, useCallback, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import type { CropState, Adjustments, OverlayEl } from '../../types/editing'
import { DEFAULT_CROP, DEFAULT_ADJUSTMENTS } from '../../types/editing'
import { createColors } from '../../theme/createTokens'
import { EditPreview } from './EditPreview'
import { CropTab } from './CropTab'
import { FilterTab } from './FilterTab'
import { AdjustTab } from './AdjustTab'
import { EffectTab } from './EffectTab'
import { DrawTab } from './DrawTab'
import { TextTab } from './TextTab'
import { StickerTab } from './StickerTab'

type Tab = 'crop' | 'filter' | 'edit' | 'effect' | 'draw' | 'text' | 'sticker'

const TABS: { id: Tab; label: string }[] = [
  { id: 'crop', label: 'Crop' },
  { id: 'filter', label: 'Filter' },
  { id: 'edit', label: 'Edit' },
  { id: 'effect', label: 'Effect' },
  { id: 'draw', label: 'Draw' },
  { id: 'text', label: 'Text' },
  { id: 'sticker', label: 'Sticker' },
]

interface EditScreenProps {
  media: SelectedMedia
  onMediaChange: (media: SelectedMedia) => void
}

export const EditScreen = memo(function EditScreen({
  media,
  onMediaChange,
}: EditScreenProps) {
  const [tab, setTab] = useState<Tab>('crop')
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const { width: screenWidth } = useWindowDimensions()

  const crop: CropState = media.crop ?? DEFAULT_CROP
  const adjustments: Adjustments = media.adjustments ?? DEFAULT_ADJUSTMENTS
  const filterId = media.filterId ?? 'none'
  const filterIntensity = media.filterIntensity ?? 100
  const effectId = media.effectId ?? 'ef-none'
  const effectIntensity = media.effectIntensity ?? 100
  const overlay: OverlayEl[] = (media.overlay as OverlayEl[]) ?? []

  /* ── Helpers de mise à jour ───────────────────────────────────── */

  const updateCrop = useCallback(
    (c: CropState) => onMediaChange({ ...media, crop: c }),
    [media, onMediaChange],
  )

  const updateFilterId = useCallback(
    (id: string) => onMediaChange({ ...media, filterId: id }),
    [media, onMediaChange],
  )

  const updateFilterIntensity = useCallback(
    (n: number) => onMediaChange({ ...media, filterIntensity: n }),
    [media, onMediaChange],
  )

  const updateAdjustments = useCallback(
    (a: Adjustments) => onMediaChange({ ...media, adjustments: a }),
    [media, onMediaChange],
  )

  const updateEffectId = useCallback(
    (id: string) => onMediaChange({ ...media, effectId: id }),
    [media, onMediaChange],
  )

  const updateEffectIntensity = useCallback(
    (n: number) => onMediaChange({ ...media, effectIntensity: n }),
    [media, onMediaChange],
  )

  const updateOverlay = useCallback(
    (els: OverlayEl[]) => onMediaChange({ ...media, overlay: els }),
    [media, onMediaChange],
  )

  /* ── Rendu du panneau inférieur ───────────────────────────────── */

  const panel = useMemo(() => {
    switch (tab) {
      case 'crop':
        return <CropTab crop={crop} onChange={updateCrop} />
      case 'filter':
        return (
          <FilterTab
            imageUri={media.uri}
            filterId={filterId}
            filterIntensity={filterIntensity}
            onFilterChange={updateFilterId}
            onIntensityChange={updateFilterIntensity}
          />
        )
      case 'edit':
        return <AdjustTab adjustments={adjustments} onChange={updateAdjustments} />
      case 'effect':
        return (
          <EffectTab
            imageUri={media.uri}
            effectId={effectId}
            effectIntensity={effectIntensity}
            onEffectChange={updateEffectId}
            onIntensityChange={updateEffectIntensity}
          />
        )
      case 'draw':
        return (
          <DrawTab overlays={overlay} onOverlaysChange={updateOverlay} />
        )
      case 'text':
        return (
          <TextTab
            overlays={overlay}
            onOverlaysChange={updateOverlay}
            selectedId={selectedOverlayId}
            onSelect={setSelectedOverlayId}
          />
        )
      case 'sticker':
        return (
          <StickerTab
            overlays={overlay}
            onOverlaysChange={updateOverlay}
            selectedId={selectedOverlayId}
            onSelect={setSelectedOverlayId}
          />
        )
      default:
        return null
    }
  }, [
    tab, crop, filterId, filterIntensity, effectId, effectIntensity,
    adjustments, overlay, selectedOverlayId, media.uri,
    updateCrop, updateFilterId, updateFilterIntensity,
    updateAdjustments, updateEffectId, updateEffectIntensity,
    updateOverlay,
  ])

  /* ── Preview dimensions ───────────────────────────────────────── */
  const previewMaxW = screenWidth - 24 // padding 12 each side
  const previewMaxH = previewMaxW * 1.2 // espace pour le preview

  return (
    <View style={styles.root}>
      {/* Aperçu */}
      <View style={styles.previewWrap}>
        <EditPreview
          uri={media.uri}
          crop={crop}
          adjustments={adjustments}
          effectId={effectId}
          containerWidth={Math.min(previewMaxW, 330)}
          containerHeight={Math.min(previewMaxH, 400)}
        />
      </View>

      {/* Onglets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabActive]}
          >
            <Text
              style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Panneau de l'onglet actif */}
      <View style={styles.panel}>
        {panel}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: createColors.canvas,
  },
  previewWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    minHeight: 200,
  },
  tabsRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: createColors.hairline,
  },
  tab: {
    paddingHorizontal: 2,
    paddingBottom: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: createColors.textPrimary,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: createColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: createColors.textPrimary,
  },
  panel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    minHeight: 100,
  },
})
