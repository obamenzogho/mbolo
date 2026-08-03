/* EditScreen.tsx — Écran d'édition des médias.

   Port du prototype createPost-instagram. 7 onglets : Crop, Filter,
   Edit (adjustments), Effect, Draw, Text, Sticker.

   Layout (de haut en bas) :
   1. Preview — flex:1, prend tout l'espace restant
   2. Tabs — barre horizontale fine (hauteur fixe ~44px)
   3. Panel — contenu du tab actif (hauteur variable, scrollable)

   Modifie directement les champs d'édition de SelectedMedia via
   onMediaChange. L'application réelle des filtres/ajustements se
   fait au moment de l'upload via expo-image-manipulator. */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import type { CropState, Adjustments, OverlayEl, VideoEdit } from '../../types/editing'
import { DEFAULT_CROP, DEFAULT_ADJUSTMENTS, DEFAULT_VIDEO_EDIT } from '../../types/editing'
import { createColors } from '../../theme/createTokens'
import { EditPreview } from './EditPreview'
import { useEditPreviewProxy } from '../../hooks/useEditPreviewProxy'
import { useVideoFrame } from '../../hooks/useVideoFrame'
import { CropTab } from './CropTab'
import { FilterTab } from './FilterTab'
import { AdjustTab } from './AdjustTab'
import { EffectTab } from './EffectTab'
import { DrawTab } from './DrawTab'
import { TextTab } from './TextTab'
import { StickerTab } from './StickerTab'
import { TrimTab } from './TrimTab'

type Tab = 'trim' | 'crop' | 'filter' | 'edit' | 'effect' | 'draw' | 'text' | 'sticker'

interface EditScreenProps {
  media: SelectedMedia
  onMediaChange: (media: SelectedMedia) => void
}

export const EditScreen = memo(function EditScreen({
  media,
  onMediaChange,
}: EditScreenProps) {
  const isVideo = media.type === 'video'
  const [tab, setTab] = useState<Tab>(isVideo ? 'trim' : 'crop')
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const overlayRef = useRef<View>(null)

  const crop: CropState = media.crop ?? DEFAULT_CROP
  const adjustments: Adjustments = media.adjustments ?? DEFAULT_ADJUSTMENTS
  const filterId = media.filterId ?? 'none'
  const filterIntensity = media.filterIntensity ?? 100
  const effectId = media.effectId ?? 'ef-none'
  const effectIntensity = media.effectIntensity ?? 100
  const overlay: OverlayEl[] = (media.overlay as OverlayEl[]) ?? []
  const overlayKey = JSON.stringify(overlay)
  const videoEdit: VideoEdit = { ...DEFAULT_VIDEO_EDIT, ...(media.video ?? {}) }

  /* Onglets conditionnels : une vidéo a tout à faire d'un trim, rien à
     faire d'un recadrage libre en plus du reste. */
  const TABS = useMemo(() => {
    const base: { id: Tab; label: string }[] = [
      { id: 'crop', label: 'Recadrer' },
      { id: 'filter', label: 'Filtre' },
      { id: 'edit', label: 'Ajuster' },
      { id: 'effect', label: 'Effet' },
      { id: 'draw', label: 'Dessin' },
      { id: 'text', label: 'Texte' },
      { id: 'sticker', label: 'Autocollant' },
    ]
    return isVideo ? [{ id: 'trim' as Tab, label: 'Découper' }, ...base] : base
  }, [isVideo])

  /* Vidéo : on filtre une frame fixe. Photo : l'image elle-même. */
  const videoFrame = useVideoFrame(isVideo ? media.uri : null, media.video?.coverTime ?? 1000)
  const preview = useEditPreviewProxy(media, isVideo ? videoFrame : media.uri)

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

  /* Capture la couche overlay (texte/sticker/dessin) en PNG transparent
     chaque fois qu'elle change. Le PNG est stocké dans media.overlayUri
     et composité par FFmpeg au moment de l'upload. */
  useEffect(() => {
    let cancelled = false
    const frame = requestAnimationFrame(async () => {
      /* Cas vide : si des overlays existaient, il faut vider overlayUri
         pour que FFmpeg ne composite pas un PNG périmé. On traite ça en
         premier, avant de tester la ref (qui est null quand la couche
         n'est pas rendue). */
      if (overlay.length === 0) {
        if (media.overlayUri) {
          onMediaChange({ ...media, overlayUri: null })
        }
        return
      }
      if (!overlayRef.current) return

      try {
        const uri = await captureRef(overlayRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        })

        if (!cancelled) {
          onMediaChange({ ...media, overlayUri: uri })
        }
      } catch (error) {
        console.warn('[overlay capture]', error)
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [overlayKey])

  const updateVideoEdit = useCallback(
    (v: VideoEdit) => onMediaChange({ ...media, video: v }),
    [media, onMediaChange],
  )

  /* Changer de média peut retirer l'onglet actif (trim n'existe que sur
     une vidéo) : on retombe sur le premier onglet disponible. */
  useEffect(() => {
    if (!TABS.some((t) => t.id === tab)) setTab(TABS[0].id)
  }, [TABS, tab])

  /* ── Rendu du panneau inférieur ───────────────────────────────── */

  const panel = useMemo(() => {
    switch (tab) {
      case 'trim':
        return (
          <TrimTab
            uri={media.uri}
            durationMs={media.duration ?? 0}
            value={videoEdit}
            onChange={updateVideoEdit}
          />
        )
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
    adjustments, overlay, videoEdit, selectedOverlayId, media.uri,
    updateCrop, updateFilterId, updateFilterIntensity,
    updateAdjustments, updateEffectId, updateEffectIntensity,
    updateOverlay, updateVideoEdit,
  ])

  /* ── Dimensions du preview ───────────────────────────────────────
     Le preview prend flex:1 (tout l'espace restant). EditPreview
     mesure lui-même son conteneur via onLayout. */

  /* Callback quand la transformation de l'image change (pan/zoom). */
  const handleTransformChange = useCallback(
    (transform: { scale: number; translateX: number; translateY: number }) => {
      onMediaChange({
        ...media,
        cropTransform: transform,
      })
    },
    [media, onMediaChange],
  )

  return (
    <View style={styles.root}>
      {/* Aperçu — flex:1, prend tout l'espace au-dessus des onglets */}
      <View style={styles.previewWrap}>
        <EditPreview
          uri={media.uri}
          previewUri={preview.uri}
          rendering={preview.rendering}
          crop={crop}
          adjustments={adjustments}
          overlay={overlay}
          overlayRef={overlayRef}
          showCropOverlay={tab === 'crop'}
          onTransformChange={tab === 'crop' ? handleTransformChange : undefined}
        />
      </View>

      {/* Onglets — barre fine, hauteur fixe */}
      <View style={styles.tabsContainer}>
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
      </View>

      {/* Panneau — prend l'espace restant en bas, scrollable */}
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
  /* Preview : flex:1 pour prendre tout l'espace disponible.
     EditPreview utilise absoluteFill pour se positionner. */
  previewWrap: {
    flex: 1,
    minHeight: 150,
    overflow: 'hidden',
  },
  /* Tabs : barre fine avec séparation subtile */
  tabsContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: createColors.hairline,
  },
  tabsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 20,
  },
  tab: {
    paddingBottom: 4,
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
  /* Panel : prend l'espace restant, scrollable si besoin */
  panel: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
})
