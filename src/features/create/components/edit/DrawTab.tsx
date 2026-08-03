/* DrawTab.tsx — Onglet Draw de l'éditeur.

   Dessin libre avec pinceau, couleur, undo/clear.
   Utilise un Canvas natif via react-native-skia serait idéal,
   mais en attendent on expose les contrôles et on stocke les strokes. */

import { memo, useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { OverlayEl } from '../../types/editing'
import { COLORS } from '../../types/editing'
import { createColors } from '../../theme/createTokens'
import { StraightenSlider } from './StraightenSlider'

interface DrawTabProps {
  overlays: OverlayEl[]
  onOverlaysChange: (els: OverlayEl[]) => void
}

export const DrawTab = memo(function DrawTab({
  overlays,
  onOverlaysChange,
}: DrawTabProps) {
  const [brushSize, setBrushSize] = useState(14)
  const [brushColor, setBrushColor] = useState('#ff2d92')

  const strokes = overlays.filter((e) => e.kind === 'stroke')

  const undoStroke = useCallback(() => {
    const idx = [...overlays].map((e) => e.kind).lastIndexOf('stroke')
    if (idx >= 0) onOverlaysChange(overlays.filter((_, j) => j !== idx))
  }, [overlays, onOverlaysChange])

  const clearStrokes = useCallback(() => {
    onOverlaysChange(overlays.filter((e) => e.kind !== 'stroke'))
  }, [overlays, onOverlaysChange])

  return (
    <View style={styles.container}>
      {/* Brush size */}
      <View style={styles.row}>
        <Text style={styles.label}>Pinceau</Text>
        <StraightenSlider
          value={brushSize}
          min={2}
          max={40}
          onChange={setBrushSize}
        />
        <Text style={styles.value}>{brushSize}</Text>
      </View>

      {/* Color */}
      <View style={styles.row}>
        <Text style={styles.label}>Couleur</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colors}
        >
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setBrushColor(c)}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                brushColor === c && styles.colorDotActive,
              ]}
            />
          ))}
        </ScrollView>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={undoStroke}
          disabled={strokes.length === 0}
          style={[styles.actionBtn, strokes.length === 0 && styles.actionDisabled]}
        >
          <Text style={styles.actionText}>Annuler</Text>
        </Pressable>
        <Pressable
          onPress={clearStrokes}
          disabled={strokes.length === 0}
          style={[styles.actionBtn, strokes.length === 0 && styles.actionDisabled]}
        >
          <Text style={styles.actionText}>Effacer</Text>
        </Pressable>
        <Text style={styles.hint}>Dessine sur ta photo</Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 11,
    color: createColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 52,
  },
  value: {
    fontSize: 11,
    color: createColors.textSecondary,
    width: 28,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  colors: { gap: 10 },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorDotActive: {
    borderWidth: 2,
    borderColor: createColors.accent,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionDisabled: { opacity: 0.4 },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: createColors.textPrimary,
  },
  hint: {
    fontSize: 11,
    color: createColors.textTertiary,
    marginLeft: 8,
  },
})
