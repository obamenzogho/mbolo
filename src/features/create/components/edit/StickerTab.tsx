/* StickerTab.tsx — Onglet Sticker de l'éditeur.

   Grille d'emojis avec taille adjustable. */

import { memo, useCallback } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { OverlayEl } from '../../types/editing'
import { STICKERS } from '../../types/editing'
import { createColors } from '../../theme/createTokens'
import { StraightenSlider } from './StraightenSlider'

const uid = () => Math.random().toString(36).slice(2)

interface StickerTabProps {
  overlays: OverlayEl[]
  onOverlaysChange: (els: OverlayEl[]) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export const StickerTab = memo(function StickerTab({
  overlays,
  onOverlaysChange,
  selectedId,
  onSelect,
}: StickerTabProps) {
  const selSticker = overlays.find(
    (e) => e.id === selectedId && e.kind === 'sticker',
  ) as Extract<OverlayEl, { kind: 'sticker' }> | undefined

  const addSticker = useCallback(
    (emoji: string) => {
      const id = uid()
      onOverlaysChange([
        ...overlays,
        { id, kind: 'sticker', emoji, x: 0.5, y: 0.5, scale: 0.12 },
      ])
      onSelect(id)
    },
    [overlays, onOverlaysChange, onSelect],
  )

  const updateScale = useCallback(
    (scale: number) => {
      if (!selSticker) return
      onOverlaysChange(
        overlays.map((e) =>
          e.id === selSticker.id ? { ...e, scale: scale / 100 } : e,
        ),
      )
    },
    [selSticker, overlays, onOverlaysChange],
  )

  const removeSticker = useCallback(() => {
    if (!selSticker) return
    onOverlaysChange(overlays.filter((e) => e.id !== selSticker.id))
    onSelect(null)
  }, [selSticker, overlays, onOverlaysChange, onSelect])

  return (
    <View style={styles.container}>
      {/* Grille d'emojis */}
      <ScrollView
        style={styles.gridScroll}
        contentContainerStyle={styles.grid}
      >
        {STICKERS.map((s, i) => (
          <Pressable
            key={i}
            onPress={() => addSticker(s)}
            style={styles.emojiBtn}
          >
            <Text style={styles.emoji}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Contrôles du sticker sélectionné */}
      {selSticker ? (
        <View style={styles.controls}>
          <View style={styles.row}>
            <Text style={styles.label}>Taille</Text>
            <StraightenSlider
              value={Math.round(selSticker.scale * 100)}
              min={6}
              max={28}
              onChange={updateScale}
            />
          </View>
          <Pressable onPress={removeSticker} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Supprimer</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  container: { gap: 8 },
  gridScroll: { maxHeight: 120 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    paddingHorizontal: 4,
  },
  emojiBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  emoji: { fontSize: 22 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 11,
    color: createColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 40,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,60,60,0.8)',
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
})
